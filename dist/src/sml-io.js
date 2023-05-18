/* (C) Stefan John / Stenway / SimpleML.com / 2023 */
import { ReliableTxtFile, ReliableTxtStreamWriter, ReverseLineIterator, SyncReliableTxtStreamWriter, SyncReverseLineIterator, WriterMode } from "@stenway/reliabletxt-io";
import { SmlDocument, SmlEmptyNode, SmlParser, SmlParserError } from "@stenway/sml";
import { SyncWsvStreamReader, WsvStreamReader } from "@stenway/wsv-io";
import { WsvLine, WsvValue } from "@stenway/wsv";
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
//# sourceMappingURL=sml-io.js.map