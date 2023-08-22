/* (C) Stefan John / Stenway / SimpleML.com / 2023 */
import { ReliableTxtFile, ReliableTxtStreamWriter, ReverseLineIterator, SyncReliableTxtStreamWriter, SyncReverseLineIterator, WriterMode } from "@stenway/reliabletxt-io";
import { BinarySmlDecoder, BinarySmlEncoder, InvalidBinarySmlError, SmlDocument, SmlElement, SmlEmptyNode, SmlParser, SmlParserError, Uint8ArrayReader } from "@stenway/sml";
import { SyncWsvStreamReader, WsvStreamReader } from "@stenway/wsv-io";
import { Uint8ArrayBuilder, WsvLine, WsvValue } from "@stenway/wsv";
import * as fs from 'node:fs';
// ----------------------------------------------------------------------
export class SmlFile {
    static loadSync(filePath, preserveWhitespacesAndComments = true) {
        const reliableTxtDocument = ReliableTxtFile.loadSync(filePath);
        return SmlDocument.parse(reliableTxtDocument.text, preserveWhitespacesAndComments, reliableTxtDocument.encoding);
    }
    static async load(filePath, preserveWhitespacesAndComments = true) {
        const reliableTxtDocument = await ReliableTxtFile.load(filePath);
        return SmlDocument.parse(reliableTxtDocument.text, preserveWhitespacesAndComments, reliableTxtDocument.encoding);
    }
    static saveSync(document, filePath, preserveWhitespacesAndComments = true) {
        const text = document.toString(preserveWhitespacesAndComments);
        ReliableTxtFile.writeAllTextSync(text, filePath, document.encoding);
    }
    static async save(document, filePath, preserveWhitespacesAndComments = true) {
        const text = document.toString(preserveWhitespacesAndComments);
        await ReliableTxtFile.writeAllText(text, filePath, document.encoding);
    }
    static appendNodesSync(nodes, templateDocument, filePath, preserveWhitespacesAndComments = true) {
        if (nodes.length === 0) {
            return;
        }
        const writer = SyncSmlStreamWriter.create(templateDocument, filePath, WriterMode.CreateOrAppend, preserveWhitespacesAndComments);
        try {
            writer.writeNodes(nodes);
        }
        finally {
            writer.close();
        }
    }
    static async appendNodes(nodes, templateDocument, filePath, preserveWhitespacesAndComments = true) {
        if (nodes.length === 0) {
            return;
        }
        const writer = await SmlStreamWriter.create(templateDocument, filePath, WriterMode.CreateOrAppend, preserveWhitespacesAndComments);
        try {
            await writer.writeNodes(nodes);
        }
        finally {
            await writer.close();
        }
    }
}
// ----------------------------------------------------------------------
export class SyncWsvStreamLineIterator {
    constructor(reader, currentLine, endKeyword) {
        this.index = 0;
        this.reader = reader;
        this.currentLine = currentLine;
        this.endKeyword = endKeyword;
    }
    static create(reader, endKeyword) {
        const currentLine = reader.readLine();
        return new SyncWsvStreamLineIterator(reader, currentLine, endKeyword);
    }
    getEndKeyword() {
        return this.endKeyword;
    }
    hasLine() {
        return this.currentLine !== null;
    }
    isEmptyLine() {
        if (this.currentLine === null) {
            throw new Error(`Invalid state`);
        }
        return this.hasLine() && !this.currentLine.hasValues;
    }
    getLine() {
        if (this.currentLine === null) {
            throw new Error(`Invalid state`);
        }
        const result = this.currentLine;
        this.currentLine = this.reader.readLine();
        this.index++;
        return result;
    }
    getLineAsArray() {
        return this.getLine().values;
    }
    toString() {
        let result = "(" + (this.index + 1) + "): ";
        if (this.currentLine !== null) {
            result += this.currentLine.toString();
        }
        return result;
    }
    getLineIndex() {
        return this.index;
    }
}
// ----------------------------------------------------------------------
export class WsvStreamLineIterator {
    constructor(reader, currentLine, endKeyword) {
        this.index = 0;
        this.reader = reader;
        this.currentLine = currentLine;
        this.endKeyword = endKeyword;
    }
    static async create(reader, endKeyword) {
        const currentLine = await reader.readLine();
        return new WsvStreamLineIterator(reader, currentLine, endKeyword);
    }
    getEndKeyword() {
        return this.endKeyword;
    }
    async hasLine() {
        return this.currentLine !== null;
    }
    async isEmptyLine() {
        if (this.currentLine === null) {
            throw new Error(`Invalid state`);
        }
        return (await this.hasLine()) && !this.currentLine.hasValues;
    }
    async getLine() {
        if (this.currentLine === null) {
            throw new Error(`Invalid state`);
        }
        const result = this.currentLine;
        this.currentLine = await this.reader.readLine();
        this.index++;
        return result;
    }
    async getLineAsArray() {
        return (await this.getLine()).values;
    }
    toString() {
        let result = "(" + (this.index + 1) + "): ";
        if (this.currentLine !== null) {
            result += this.currentLine.toString();
        }
        return result;
    }
    getLineIndex() {
        return this.index;
    }
}
// ----------------------------------------------------------------------
export class SyncSmlStreamReader {
    get encoding() {
        return this.reader.encoding;
    }
    get isClosed() {
        return this.reader.isClosed;
    }
    get handle() {
        return this.reader.handle;
    }
    constructor(reader, root, endKeyword, iterator, preserveWhitespacesAndComments, emptyNodesBefore, isAppendReader) {
        this.endReached = false;
        this.emptyNodesBefore = [];
        this.reader = reader;
        this.root = root;
        this.endKeyword = endKeyword;
        this.iterator = iterator;
        this.preserveWhitespacesAndComments = preserveWhitespacesAndComments;
        if (!preserveWhitespacesAndComments) {
            emptyNodesBefore = [];
        }
        this.emptyNodesBefore = emptyNodesBefore;
        this.isAppendReader = isAppendReader;
    }
    static create(filePath, preserveWhitespacesAndComments = true, chunkSize = 4096) {
        const reader = SyncWsvStreamReader.create(filePath, preserveWhitespacesAndComments, chunkSize);
        try {
            const result = SmlEndKeywordDetector.getEndKeywordAndPositionSync(reader.handle);
            const endKeyword = result[0];
            const iterator = SyncWsvStreamLineIterator.create(reader, endKeyword);
            const emptyNodesBefore = [];
            const root = SmlParser.readRootElementSync(iterator, emptyNodesBefore);
            return new SyncSmlStreamReader(reader, root, endKeyword, iterator, preserveWhitespacesAndComments, emptyNodesBefore, false);
        }
        catch (error) {
            reader.close();
            throw error;
        }
    }
    static getAppendReader(writer, preserveWhitespacesAndComments = true, chunkSize = 4096) {
        if (!writer.existing) {
            throw new Error(`Writer is not in append mode`);
        }
        const reader = SyncWsvStreamReader.getAppendReader(writer.handle, preserveWhitespacesAndComments, chunkSize);
        const iterator = SyncWsvStreamLineIterator.create(reader, writer.endKeyword);
        const emptyNodesBefore = [];
        const root = SmlParser.readRootElementSync(iterator, emptyNodesBefore);
        return new SyncSmlStreamReader(reader, root, writer.endKeyword, iterator, preserveWhitespacesAndComments, emptyNodesBefore, true);
    }
    readNode() {
        if (this.endReached || (this.isAppendReader && this.iterator.hasLine() === false)) {
            return null;
        }
        let result = null;
        if (!this.preserveWhitespacesAndComments) {
            for (;;) {
                result = SmlParser.readNodeSync(this.iterator, this.root);
                if (result instanceof SmlEmptyNode) {
                    continue;
                }
                break;
            }
        }
        else {
            result = SmlParser.readNodeSync(this.iterator, this.root);
        }
        if (result === null) {
            this.endReached = true;
        }
        return result;
    }
    close() {
        this.reader.close();
    }
}
// ----------------------------------------------------------------------
export class SmlStreamReader {
    get encoding() {
        return this.reader.encoding;
    }
    get isClosed() {
        return this.reader.isClosed;
    }
    get handle() {
        return this.reader.handle;
    }
    constructor(reader, root, endKeyword, iterator, preserveWhitespacesAndComments, emptyNodesBefore, isAppendReader) {
        this.endReached = false;
        this.reader = reader;
        this.root = root;
        this.endKeyword = endKeyword;
        this.iterator = iterator;
        this.preserveWhitespacesAndComments = preserveWhitespacesAndComments;
        if (!preserveWhitespacesAndComments) {
            emptyNodesBefore = [];
        }
        this.emptyNodesBefore = emptyNodesBefore;
        this.isAppendReader = isAppendReader;
    }
    static async create(filePath, preserveWhitespacesAndComments = true, chunkSize = 4096) {
        const reader = await WsvStreamReader.create(filePath, preserveWhitespacesAndComments, chunkSize);
        try {
            const result = await SmlEndKeywordDetector.getEndKeywordAndPosition(reader.handle);
            const endKeyword = result[0];
            const iterator = await WsvStreamLineIterator.create(reader, endKeyword);
            const emptyNodesBefore = [];
            const root = await SmlParser.readRootElement(iterator, emptyNodesBefore);
            return new SmlStreamReader(reader, root, endKeyword, iterator, preserveWhitespacesAndComments, emptyNodesBefore, false);
        }
        catch (error) {
            await reader.close();
            throw error;
        }
    }
    static async getAppendReader(writer, preserveWhitespacesAndComments = true, chunkSize = 4096) {
        if (!writer.existing) {
            throw new Error(`Writer is not in append mode`);
        }
        const reader = WsvStreamReader.getAppendReader(writer.handle, preserveWhitespacesAndComments, chunkSize);
        const iterator = await WsvStreamLineIterator.create(reader, writer.endKeyword);
        const emptyNodesBefore = [];
        const root = await SmlParser.readRootElement(iterator, emptyNodesBefore);
        return new SmlStreamReader(reader, root, writer.endKeyword, iterator, preserveWhitespacesAndComments, emptyNodesBefore, true);
    }
    async readNode() {
        if (this.endReached || (this.isAppendReader && (await this.iterator.hasLine()) === false)) {
            return null;
        }
        let result = null;
        if (!this.preserveWhitespacesAndComments) {
            for (;;) {
                result = await SmlParser.readNode(this.iterator, this.root);
                if (result instanceof SmlEmptyNode) {
                    continue;
                }
                break;
            }
        }
        else {
            result = await SmlParser.readNode(this.iterator, this.root);
        }
        if (result === null) {
            this.endReached = true;
        }
        return result;
    }
    async close() {
        await this.reader.close();
    }
}
// ----------------------------------------------------------------------
class SmlEndKeywordDetector {
    static getEndKeywordAndPositionSync(handle) {
        try {
            let endKeyword;
            const iterator = SyncReverseLineIterator.create(handle);
            for (;;) {
                const lineStr = iterator.getLine();
                const line = WsvLine.parse(lineStr);
                if (line.hasValues) {
                    if (line.values.length > 1) {
                        throw new SmlParserError(-1, "Invalid end line");
                    }
                    endKeyword = line.values[0];
                    break;
                }
            }
            const remainingLength = iterator.getPosition() + 1;
            return [endKeyword, remainingLength];
        }
        catch (error) {
            throw new Error(`Could not detect end keyword: ${error}`);
        }
    }
    static async getEndKeywordAndPosition(handle) {
        try {
            let endKeyword;
            const iterator = await ReverseLineIterator.create(handle);
            for (;;) {
                const lineStr = await iterator.getLine();
                const line = WsvLine.parse(lineStr);
                if (line.hasValues) {
                    if (line.values.length > 1) {
                        throw new SmlParserError(-1, "Invalid end line");
                    }
                    endKeyword = line.values[0];
                    break;
                }
            }
            const remainingLength = iterator.getPosition() + 1;
            return [endKeyword, remainingLength];
        }
        catch (error) {
            throw new Error(`Could not detect end keyword: ${error}`);
        }
    }
}
// ----------------------------------------------------------------------
export class SyncSmlStreamWriter {
    get encoding() {
        return this.writer.encoding;
    }
    get isClosed() {
        return this.writer.isClosed;
    }
    get handle() {
        return this.writer.handle;
    }
    get existing() {
        return this.writer.existing;
    }
    constructor(writer, defaultIndentation, preserveWhitespacesAndComment, endKeyword) {
        this.writer = writer;
        this.defaultIndentation = defaultIndentation;
        this.preserveWhitespacesAndComments = preserveWhitespacesAndComment;
        this.endKeyword = endKeyword;
    }
    static create(templateDocument, filePath, mode = WriterMode.CreateOrOverwrite, preserveWhitespacesAndComment = true) {
        const writer = SyncReliableTxtStreamWriter.create(filePath, templateDocument.encoding, mode);
        let endKeyword;
        try {
            if (writer.existing) {
                const result = SmlEndKeywordDetector.getEndKeywordAndPositionSync(writer.handle);
                endKeyword = result[0];
                const restLength = result[1];
                writer.internalTruncate(restLength);
            }
            else {
                endKeyword = templateDocument.endKeyword;
                const rootElementName = templateDocument.root.name;
                writer.writeLine(WsvValue.serialize(rootElementName));
            }
        }
        catch (error) {
            writer.close();
            throw error;
        }
        return new SyncSmlStreamWriter(writer, templateDocument.defaultIndentation, preserveWhitespacesAndComment, endKeyword);
    }
    writeNode(node) {
        const lines = [];
        node.internalSerialize(lines, 1, this.defaultIndentation, this.endKeyword, this.preserveWhitespacesAndComments);
        this.writer.writeLines(lines);
    }
    writeNodes(nodes) {
        for (const node of nodes) {
            this.writeNode(node);
        }
    }
    close() {
        if (!this.writer.isClosed) {
            this.writer.writeLine(WsvValue.serialize(this.endKeyword));
            this.writer.close();
        }
    }
}
// ----------------------------------------------------------------------
export class SmlStreamWriter {
    get encoding() {
        return this.writer.encoding;
    }
    get isClosed() {
        return this.writer.isClosed;
    }
    get handle() {
        return this.writer.handle;
    }
    get existing() {
        return this.writer.existing;
    }
    constructor(writer, defaultIndentation, preserveWhitespacesAndComment, endKeyword) {
        this.writer = writer;
        this.defaultIndentation = defaultIndentation;
        this.preserveWhitespacesAndComments = preserveWhitespacesAndComment;
        this.endKeyword = endKeyword;
    }
    static async create(templateDocument, filePath, mode = WriterMode.CreateOrOverwrite, preserveWhitespacesAndComment = true) {
        const writer = await ReliableTxtStreamWriter.create(filePath, templateDocument.encoding, mode);
        let endKeyword;
        try {
            if (writer.existing) {
                const result = await SmlEndKeywordDetector.getEndKeywordAndPosition(writer.handle);
                endKeyword = result[0];
                const restLength = result[1];
                await writer.internalTruncate(restLength);
            }
            else {
                endKeyword = templateDocument.endKeyword;
                const rootElementName = templateDocument.root.name;
                await writer.writeLine(WsvValue.serialize(rootElementName));
            }
        }
        catch (error) {
            await writer.close();
            throw error;
        }
        return new SmlStreamWriter(writer, templateDocument.defaultIndentation, preserveWhitespacesAndComment, endKeyword);
    }
    async writeNode(node) {
        const lines = [];
        node.internalSerialize(lines, 1, this.defaultIndentation, this.endKeyword, this.preserveWhitespacesAndComments);
        await this.writer.writeLines(lines);
    }
    async writeNodes(nodes) {
        for (const node of nodes) {
            await this.writeNode(node);
        }
    }
    async close() {
        if (!this.writer.isClosed) {
            await this.writer.writeLine(WsvValue.serialize(this.endKeyword));
            await this.writer.close();
        }
    }
}
// ----------------------------------------------------------------------
export class SyncBinarySmlFileHandle {
    get isClosed() {
        return this.handle === null;
    }
    get canRead() {
        return this.mode === 0 || this.mode === 2;
    }
    get canWrite() {
        return this.mode === 1 || this.mode === 2;
    }
    constructor(handle, preambleSize, mode, existing) {
        this.handle = handle;
        this.preambleSize = preambleSize;
        this.mode = mode;
        this.existing = existing;
        this.builder = new Uint8ArrayBuilder();
    }
    getSize() {
        if (this.handle === null) {
            throw new Error(`File handle closed`);
        }
        return fs.fstatSync(this.handle).size;
    }
    getAllBytes() {
        if (this.handle === null) {
            throw new Error(`File handle closed`);
        }
        if (!this.canRead) {
            throw new Error(`Not a reader`);
        }
        const fileSize = this.getSize();
        const buffer = new Uint8Array(fileSize);
        const numBytesRead = fs.readSync(this.handle, buffer, 0, fileSize, 0);
        if (numBytesRead !== fileSize) {
            throw new Error(`File was not fully read`);
        }
        return buffer;
    }
    appendNode(node) {
        if (this.handle === null) {
            throw new Error(`File handle closed`);
        }
        if (!this.canWrite) {
            throw new Error(`Not a writer`);
        }
        const fileSize = this.getSize();
        this.builder.reset();
        BinarySmlEncoder.internalEncodeNode(node, this.builder);
        const bytes = this.builder.toArray();
        const numBytesWritten = fs.writeSync(this.handle, bytes, 0, bytes.length, fileSize);
        if (numBytesWritten !== bytes.length) {
            throw new Error(`Node was not fully written`);
        }
    }
    appendNodes(nodes) {
        if (this.handle === null) {
            throw new Error(`File handle closed`);
        }
        if (!this.canWrite) {
            throw new Error(`Not a writer`);
        }
        const fileSize = this.getSize();
        this.builder.reset();
        BinarySmlEncoder.internalEncodeNodes(nodes, this.builder);
        const bytes = this.builder.toArray();
        const numBytesWritten = fs.writeSync(this.handle, bytes, 0, bytes.length, fileSize);
        if (numBytesWritten !== bytes.length) {
            throw new Error(`Nodes were not fully written`);
        }
    }
    readBytes(buffer, offset, length, position = null) {
        if (this.handle === null) {
            throw new Error(`File handle closed`);
        }
        if (!this.canRead) {
            throw new Error(`Not a reader`);
        }
        return fs.readSync(this.handle, buffer, offset, length, position);
    }
    close() {
        if (this.handle !== null) {
            fs.closeSync(this.handle);
            this.handle = null;
        }
    }
    static createReader(filePath) {
        const handle = fs.openSync(filePath, "r");
        try {
            const version = this.getVersion(handle);
            if (version !== "1") {
                throw new Error(`Not supported BinarySML version '${version}'`);
            }
            return new SyncBinarySmlFileHandle(handle, 3, 0, true);
        }
        catch (error) {
            fs.closeSync(handle);
            throw error;
        }
    }
    static createWriter(templateRootElementName, filePath, overwriteExisting = true) {
        const handle = fs.openSync(filePath, overwriteExisting ? "w" : "wx");
        try {
            const headerBytes = BinarySmlEncoder.encodeElement(new SmlElement(templateRootElementName), true);
            const numBytesWritten = fs.writeSync(handle, headerBytes, 0, headerBytes.length, 0);
            if (numBytesWritten !== headerBytes.length) {
                throw new Error(`Header was not fully written`);
            }
            return new SyncBinarySmlFileHandle(handle, headerBytes.length, 1, false);
        }
        catch (error) {
            fs.closeSync(handle);
            throw error;
        }
    }
    static createAppender(templateRootElementName, filePath) {
        try {
            const handle = fs.openSync(filePath, "r+");
            try {
                const version = this.getVersion(handle);
                if (version !== "1") {
                    throw new Error(`Not supported BinarySML version '${version}'`);
                }
                return new SyncBinarySmlFileHandle(handle, 3, 2, true);
            }
            catch (error) {
                fs.closeSync(handle);
                throw error;
            }
        }
        catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (error.code === "ENOENT") {
                return this.createWriter(templateRootElementName, filePath, false);
            }
            else {
                throw error;
            }
        }
    }
    static getVersion(handle) {
        let buffer = new Uint8Array(3);
        const numBytesRead = fs.readSync(handle, buffer, 0, 3, 0);
        buffer = buffer.subarray(0, numBytesRead);
        return BinarySmlDecoder.getVersion(buffer);
    }
}
// ----------------------------------------------------------------------
export class BinarySmlFileHandle {
    get isClosed() {
        return this.handle === null;
    }
    get canRead() {
        return this.mode === 0 || this.mode === 2;
    }
    get canWrite() {
        return this.mode === 1 || this.mode === 2;
    }
    constructor(handle, preambleSize, mode, existing) {
        this.handle = handle;
        this.preambleSize = preambleSize;
        this.mode = mode;
        this.existing = existing;
        this.builder = new Uint8ArrayBuilder();
    }
    async getSize() {
        if (this.handle === null) {
            throw new Error(`File handle closed`);
        }
        const stats = await this.handle.stat();
        return stats.size;
    }
    async getAllBytes() {
        if (this.handle === null) {
            throw new Error(`File handle closed`);
        }
        if (!this.canRead) {
            throw new Error(`Not a reader`);
        }
        const fileSize = await this.getSize();
        const buffer = new Uint8Array(fileSize);
        const result = await this.handle.read(buffer, 0, fileSize, 0);
        if (result.bytesRead !== fileSize) {
            throw new Error(`File was not fully read`);
        }
        return buffer;
    }
    async appendNode(node) {
        if (this.handle === null) {
            throw new Error(`File handle closed`);
        }
        if (!this.canWrite) {
            throw new Error(`Not a writer`);
        }
        const fileSize = await this.getSize();
        this.builder.reset();
        BinarySmlEncoder.internalEncodeNode(node, this.builder);
        const bytes = this.builder.toArray();
        const result = await this.handle.write(bytes, 0, bytes.length, fileSize);
        if (result.bytesWritten !== bytes.length) {
            throw new Error(`Node was not fully written`);
        }
    }
    async appendNodes(nodes) {
        if (this.handle === null) {
            throw new Error(`File handle closed`);
        }
        if (!this.canWrite) {
            throw new Error(`Not a writer`);
        }
        const fileSize = await this.getSize();
        this.builder.reset();
        BinarySmlEncoder.internalEncodeNodes(nodes, this.builder);
        const bytes = this.builder.toArray();
        const result = await this.handle.write(bytes, 0, bytes.length, fileSize);
        if (result.bytesWritten !== bytes.length) {
            throw new Error(`Nodes were not fully written`);
        }
    }
    async readBytes(buffer, offset, length, position = null) {
        if (this.handle === null) {
            throw new Error(`File handle closed`);
        }
        if (!this.canRead) {
            throw new Error(`Not a reader`);
        }
        const result = await this.handle.read(buffer, offset, length, position);
        return result.bytesRead;
    }
    async close() {
        if (this.handle !== null) {
            await this.handle.close();
            this.handle = null;
        }
    }
    static async createReader(filePath) {
        const handle = await fs.promises.open(filePath, "r");
        try {
            const version = await this.getVersion(handle);
            if (version !== "1") {
                throw new Error(`Not supported BinarySML version '${version}'`);
            }
            return new BinarySmlFileHandle(handle, 3, 0, true);
        }
        catch (error) {
            await handle.close();
            throw error;
        }
    }
    static async createWriter(templateRootElementName, filePath, overwriteExisting = true) {
        const handle = await fs.promises.open(filePath, overwriteExisting ? "w" : "wx");
        try {
            const headerBytes = BinarySmlEncoder.encodeElement(new SmlElement(templateRootElementName), true);
            const result = await handle.write(headerBytes, 0, headerBytes.length, 0);
            if (result.bytesWritten !== headerBytes.length) {
                throw new Error(`Header was not fully written`);
            }
            return new BinarySmlFileHandle(handle, headerBytes.length, 1, false);
        }
        catch (error) {
            await handle.close();
            throw error;
        }
    }
    static async createAppender(templateRootElementName, filePath) {
        try {
            const handle = await fs.promises.open(filePath, "r+");
            try {
                const version = await this.getVersion(handle);
                if (version !== "1") {
                    throw new Error(`Not supported BinarySML version '${version}'`);
                }
                return new BinarySmlFileHandle(handle, 3, 2, true);
            }
            catch (error) {
                await handle.close();
                throw error;
            }
        }
        catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (error.code === "ENOENT") {
                return await this.createWriter(templateRootElementName, filePath, false);
            }
            else {
                throw error;
            }
        }
    }
    static async getVersion(handle) {
        let buffer = new Uint8Array(3);
        const result = await handle.read(buffer, 0, 3, 0);
        buffer = buffer.subarray(0, result.bytesRead);
        return BinarySmlDecoder.getVersion(buffer);
    }
}
// ----------------------------------------------------------------------
export class BinarySmlFile {
    static loadSync(filePath) {
        const handle = SyncBinarySmlFileHandle.createReader(filePath);
        try {
            const bytes = handle.getAllBytes();
            return BinarySmlDecoder.decode(bytes);
        }
        finally {
            handle.close();
        }
    }
    static async load(filePath) {
        const handle = await BinarySmlFileHandle.createReader(filePath);
        try {
            const bytes = await handle.getAllBytes();
            return BinarySmlDecoder.decode(bytes);
        }
        finally {
            await handle.close();
        }
    }
    static saveSync(document, filePath, overwriteExisting = true) {
        const handle = fs.openSync(filePath, overwriteExisting ? "w" : "wx");
        try {
            const bytes = document.toBinarySml();
            const numBytesWritten = fs.writeSync(handle, bytes, 0, bytes.length, 0);
            if (numBytesWritten !== bytes.length) {
                throw new Error(`Document was not fully written`);
            }
        }
        finally {
            fs.closeSync(handle);
        }
    }
    static async save(document, filePath, overwriteExisting = true) {
        const handle = await fs.promises.open(filePath, overwriteExisting ? "w" : "wx");
        try {
            const bytes = document.toBinarySml();
            const result = await handle.write(bytes, 0, bytes.length, 0);
            if (result.bytesWritten !== bytes.length) {
                throw new Error(`Document was not fully written`);
            }
        }
        finally {
            await handle.close();
        }
    }
    static appendNodesSync(nodes, templateRootElementName, filePath) {
        if (nodes.length === 0) {
            return;
        }
        const handle = SyncBinarySmlFileHandle.createAppender(templateRootElementName, filePath);
        try {
            handle.appendNodes(nodes);
        }
        finally {
            handle.close();
        }
    }
    static async appendNodes(nodes, templateRootElementName, filePath) {
        if (nodes.length === 0) {
            return;
        }
        const handle = await BinarySmlFileHandle.createAppender(templateRootElementName, filePath);
        try {
            await handle.appendNodes(nodes);
        }
        finally {
            await handle.close();
        }
    }
}
// ----------------------------------------------------------------------
export class SyncBinarySmlStreamReader {
    get isClosed() {
        return this.handle.isClosed;
    }
    constructor(handle, chunkSize) {
        this.rest = new Uint8Array(0);
        if (chunkSize < 32) {
            throw new RangeError("Chunk size too small");
        }
        this.handle = handle;
        this.position = handle.preambleSize;
        this.buffer = new Uint8Array(chunkSize);
        this.reader = new Uint8ArrayReader(new Uint8Array(), 0);
        this.root = new SmlElement("Root");
    }
    static create(filePath, chunkSize = 4096) {
        const handle = SyncBinarySmlFileHandle.createReader(filePath);
        try {
            const reader = new SyncBinarySmlStreamReader(handle, chunkSize);
            reader.readHead();
            return reader;
        }
        catch (error) {
            handle.close();
            throw error;
        }
    }
    static getAppendReader(writer, chunkSize = 4096) {
        if (!writer.existing) {
            throw new Error(`Writer is not in append mode`);
        }
        const reader = new SyncBinarySmlStreamReader(writer.handle, chunkSize);
        reader.readHead();
        return reader;
    }
    readHead() {
        const numBytesRead = this.handle.readBytes(this.buffer, 0, this.buffer.length, this.position);
        if (numBytesRead === 0) {
            throw new InvalidBinarySmlError();
        }
        const partialBuffer = this.buffer.subarray(0, numBytesRead);
        this.reader.reset(partialBuffer, 0);
        this.root.name = this.reader.readRootElementStart();
        this.position += numBytesRead;
        this.rest = partialBuffer.slice(this.reader.offset);
    }
    readNodeBuffer() {
        if (this.rest === null) {
            return null;
        }
        let lastStartIndex = 0;
        let current = this.rest;
        for (;;) {
            const endIndex = BinarySmlDecoder.internalGetNodeEndIndex(current, lastStartIndex);
            if (endIndex >= 0) {
                const nodeBytes = current.subarray(0, endIndex + 1);
                this.rest = current.subarray(endIndex + 1);
                return nodeBytes;
            }
            else {
                lastStartIndex = current.length;
                const numBytesRead = this.handle.readBytes(this.buffer, 0, this.buffer.length, this.position);
                if (numBytesRead === 0) {
                    this.rest = null;
                    if (current.length === 0) {
                        return null;
                    }
                    return current;
                }
                this.position += numBytesRead;
                const newCurrent = new Uint8Array(current.length + numBytesRead);
                newCurrent.set(current, 0);
                if (numBytesRead < this.buffer.length) {
                    newCurrent.set(this.buffer.subarray(0, numBytesRead), current.length);
                }
                else {
                    newCurrent.set(this.buffer, current.length);
                }
                current = newCurrent;
            }
        }
    }
    readNode() {
        if (this.handle.isClosed) {
            throw new Error("Stream reader is closed");
        }
        const nodeBuffer = this.readNodeBuffer();
        if (nodeBuffer === null) {
            return null;
        }
        this.reader.reset(nodeBuffer, 0);
        return BinarySmlDecoder.internalDecodeNode(this.reader);
    }
    close() {
        this.handle.close();
    }
}
// ----------------------------------------------------------------------
export class BinarySmlStreamReader {
    get isClosed() {
        return this.handle.isClosed;
    }
    constructor(handle, chunkSize) {
        this.rest = new Uint8Array(0);
        if (chunkSize < 32) {
            throw new RangeError("Chunk size too small");
        }
        this.handle = handle;
        this.position = handle.preambleSize;
        this.buffer = new Uint8Array(chunkSize);
        this.reader = new Uint8ArrayReader(new Uint8Array(), 0);
        this.root = new SmlElement("Root");
    }
    static async create(filePath, chunkSize = 4096) {
        const handle = await BinarySmlFileHandle.createReader(filePath);
        try {
            const reader = new BinarySmlStreamReader(handle, chunkSize);
            await reader.readHead();
            return reader;
        }
        catch (error) {
            await handle.close();
            throw error;
        }
    }
    static async getAppendReader(writer, chunkSize = 4096) {
        if (!writer.existing) {
            throw new Error(`Writer is not in append mode`);
        }
        const reader = new BinarySmlStreamReader(writer.handle, chunkSize);
        await reader.readHead();
        return reader;
    }
    async readHead() {
        const numBytesRead = await this.handle.readBytes(this.buffer, 0, this.buffer.length, this.position);
        if (numBytesRead === 0) {
            throw new InvalidBinarySmlError();
        }
        const partialBuffer = this.buffer.subarray(0, numBytesRead);
        this.reader.reset(partialBuffer, 0);
        this.root.name = this.reader.readRootElementStart();
        this.position += numBytesRead;
        this.rest = partialBuffer.slice(this.reader.offset);
    }
    async readNodeBuffer() {
        if (this.rest === null) {
            return null;
        }
        let lastStartIndex = 0;
        let current = this.rest;
        for (;;) {
            const endIndex = BinarySmlDecoder.internalGetNodeEndIndex(current, lastStartIndex);
            if (endIndex >= 0) {
                const nodeBytes = current.subarray(0, endIndex + 1);
                this.rest = current.subarray(endIndex + 1);
                return nodeBytes;
            }
            else {
                lastStartIndex = current.length;
                const numBytesRead = await this.handle.readBytes(this.buffer, 0, this.buffer.length, this.position);
                if (numBytesRead === 0) {
                    this.rest = null;
                    if (current.length === 0) {
                        return null;
                    }
                    return current;
                }
                this.position += numBytesRead;
                const newCurrent = new Uint8Array(current.length + numBytesRead);
                newCurrent.set(current, 0);
                if (numBytesRead < this.buffer.length) {
                    newCurrent.set(this.buffer.subarray(0, numBytesRead), current.length);
                }
                else {
                    newCurrent.set(this.buffer, current.length);
                }
                current = newCurrent;
            }
        }
    }
    async readNode() {
        if (this.handle.isClosed) {
            throw new Error("Stream reader is closed");
        }
        const nodeBuffer = await this.readNodeBuffer();
        if (nodeBuffer === null) {
            return null;
        }
        this.reader.reset(nodeBuffer, 0);
        const result = BinarySmlDecoder.internalDecodeNode(this.reader);
        if (this.reader.hasBytes) {
            throw new InvalidBinarySmlError();
        }
        return result;
    }
    async close() {
        await this.handle.close();
    }
}
// ----------------------------------------------------------------------
export class SyncBinarySmlStreamWriter {
    get isClosed() {
        return this.handle.isClosed;
    }
    get existing() {
        return this.handle.existing;
    }
    constructor(handle) {
        this.handle = handle;
    }
    static create(templateRootElementName, filePath, mode = WriterMode.CreateOrOverwrite) {
        if (mode === WriterMode.CreateOrAppend) {
            const handle = SyncBinarySmlFileHandle.createAppender(templateRootElementName, filePath);
            try {
                return new SyncBinarySmlStreamWriter(handle);
            }
            catch (error) {
                handle.close();
                throw error;
            }
        }
        else {
            const overwriteExisting = mode === WriterMode.CreateOrOverwrite;
            const handle = SyncBinarySmlFileHandle.createWriter(templateRootElementName, filePath, overwriteExisting);
            try {
                return new SyncBinarySmlStreamWriter(handle);
            }
            catch (error) {
                handle.close();
                throw error;
            }
        }
    }
    writeNode(node) {
        this.handle.appendNode(node);
    }
    writeNodes(nodes) {
        this.handle.appendNodes(nodes);
    }
    close() {
        this.handle.close();
    }
}
// ----------------------------------------------------------------------
export class BinarySmlStreamWriter {
    get isClosed() {
        return this.handle.isClosed;
    }
    get existing() {
        return this.handle.existing;
    }
    constructor(handle) {
        this.handle = handle;
    }
    static async create(templateRootElementName, filePath, mode = WriterMode.CreateOrOverwrite) {
        if (mode === WriterMode.CreateOrAppend) {
            const handle = await BinarySmlFileHandle.createAppender(templateRootElementName, filePath);
            try {
                return new BinarySmlStreamWriter(handle);
            }
            catch (error) {
                await handle.close();
                throw error;
            }
        }
        else {
            const overwriteExisting = mode === WriterMode.CreateOrOverwrite;
            const handle = await BinarySmlFileHandle.createWriter(templateRootElementName, filePath, overwriteExisting);
            try {
                return new BinarySmlStreamWriter(handle);
            }
            catch (error) {
                await handle.close();
                throw error;
            }
        }
    }
    async writeNode(node) {
        await this.handle.appendNode(node);
    }
    async writeNodes(nodes) {
        await this.handle.appendNodes(nodes);
    }
    async close() {
        await this.handle.close();
    }
}
//# sourceMappingURL=sml-io.js.map