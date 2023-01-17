"use strict";
/* (C) Stefan John / Stenway / SimpleML.com / 2023 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmlStreamWriter = exports.SyncSmlStreamWriter = exports.SmlStreamReader = exports.SyncSmlStreamReader = exports.WsvStreamLineIterator = exports.SyncWsvStreamLineIterator = exports.SmlFile = void 0;
const reliabletxt_io_1 = require("@stenway/reliabletxt-io");
const sml_1 = require("@stenway/sml");
const wsv_io_1 = require("@stenway/wsv-io");
const wsv_1 = require("@stenway/wsv");
// ----------------------------------------------------------------------
class SmlFile {
    static loadSync(filePath, preserveWhitespacesAndComments = true) {
        const reliableTxtDocument = reliabletxt_io_1.ReliableTxtFile.loadSync(filePath);
        return sml_1.SmlDocument.parse(reliableTxtDocument.text, preserveWhitespacesAndComments, reliableTxtDocument.encoding);
    }
    static load(filePath, preserveWhitespacesAndComments = true) {
        return __awaiter(this, void 0, void 0, function* () {
            const reliableTxtDocument = yield reliabletxt_io_1.ReliableTxtFile.load(filePath);
            return sml_1.SmlDocument.parse(reliableTxtDocument.text, preserveWhitespacesAndComments, reliableTxtDocument.encoding);
        });
    }
    static saveSync(document, filePath, preserveWhitespacesAndComments = true) {
        const text = document.toString(preserveWhitespacesAndComments);
        reliabletxt_io_1.ReliableTxtFile.writeAllTextSync(text, filePath, document.encoding);
    }
    static save(document, filePath, preserveWhitespacesAndComments = true) {
        return __awaiter(this, void 0, void 0, function* () {
            const text = document.toString(preserveWhitespacesAndComments);
            yield reliabletxt_io_1.ReliableTxtFile.writeAllText(text, filePath, document.encoding);
        });
    }
    static appendNodesSync(nodes, templateDocument, filePath, preserveWhitespacesAndComments = true) {
        if (nodes.length === 0) {
            return;
        }
        const writer = new SyncSmlStreamWriter(templateDocument, filePath, preserveWhitespacesAndComments, true);
        try {
            for (const node of nodes) {
                writer.writeNode(node);
            }
        }
        finally {
            writer.close();
        }
    }
    static appendNodes(nodes, templateDocument, filePath, preserveWhitespacesAndComments = true) {
        return __awaiter(this, void 0, void 0, function* () {
            if (nodes.length === 0) {
                return;
            }
            const writer = yield SmlStreamWriter.create(templateDocument, filePath, preserveWhitespacesAndComments, true);
            try {
                for (const node of nodes) {
                    yield writer.writeNode(node);
                }
            }
            finally {
                yield writer.close();
            }
        });
    }
}
exports.SmlFile = SmlFile;
// ----------------------------------------------------------------------
class SyncWsvStreamLineIterator {
    constructor(reader, endKeyword) {
        this.index = 0;
        this.reader = reader;
        this.endKeyword = endKeyword;
        this.currentLine = reader.readLine();
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
exports.SyncWsvStreamLineIterator = SyncWsvStreamLineIterator;
// ----------------------------------------------------------------------
class WsvStreamLineIterator {
    constructor(reader, currentLine, endKeyword) {
        this.index = 0;
        this.reader = reader;
        this.currentLine = currentLine;
        this.endKeyword = endKeyword;
    }
    static create(reader, endKeyword) {
        return __awaiter(this, void 0, void 0, function* () {
            const currentLine = yield reader.readLine();
            return new WsvStreamLineIterator(reader, currentLine, endKeyword);
        });
    }
    getEndKeyword() {
        return this.endKeyword;
    }
    hasLine() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.currentLine !== null;
        });
    }
    isEmptyLine() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.currentLine === null) {
                throw new Error(`Invalid state`);
            }
            return (yield this.hasLine()) && !this.currentLine.hasValues;
        });
    }
    getLine() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.currentLine === null) {
                throw new Error(`Invalid state`);
            }
            const result = this.currentLine;
            this.currentLine = yield this.reader.readLine();
            this.index++;
            return result;
        });
    }
    getLineAsArray() {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.getLine()).values;
        });
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
exports.WsvStreamLineIterator = WsvStreamLineIterator;
// ----------------------------------------------------------------------
class SyncSmlStreamReader {
    constructor(filePath, preserveWhitespacesAndComments = true, chunkSize = 4096) {
        this.emptyNodesBefore = [];
        this.reader = new wsv_io_1.SyncWsvStreamReader(filePath, preserveWhitespacesAndComments, chunkSize);
        try {
            this.preserveWhitespacesAndComments = preserveWhitespacesAndComments;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const result = SmlEndKeywordDetector.getEndKeywordAndPositionSync(this.reader.handle, this.encoding);
            this.endKeyword = result[0];
            this.iterator = new SyncWsvStreamLineIterator(this.reader, this.endKeyword);
            this.root = sml_1.SmlParser.readRootElementSync(this.iterator, this.emptyNodesBefore);
            if (!preserveWhitespacesAndComments) {
                this.emptyNodesBefore = [];
            }
        }
        catch (error) {
            this.reader.close();
            throw error;
        }
    }
    get encoding() {
        return this.reader.encoding;
    }
    get isClosed() {
        return this.reader.isClosed;
    }
    get handle() {
        return this.reader.handle;
    }
    readNode() {
        if (!this.preserveWhitespacesAndComments) {
            for (;;) {
                const result = sml_1.SmlParser.readNodeSync(this.iterator, this.root);
                if (result instanceof sml_1.SmlEmptyNode) {
                    continue;
                }
                return result;
            }
        }
        else {
            return sml_1.SmlParser.readNodeSync(this.iterator, this.root);
        }
    }
    close() {
        this.reader.close();
    }
}
exports.SyncSmlStreamReader = SyncSmlStreamReader;
// ----------------------------------------------------------------------
class SmlStreamReader {
    constructor(reader, root, endKeyword, iterator, preserveWhitespacesAndComments, emptyNodesBefore) {
        this.reader = reader;
        this.root = root;
        this.endKeyword = endKeyword;
        this.iterator = iterator;
        this.preserveWhitespacesAndComments = preserveWhitespacesAndComments;
        if (!preserveWhitespacesAndComments) {
            emptyNodesBefore = [];
        }
        this.emptyNodesBefore = emptyNodesBefore;
    }
    get encoding() {
        return this.reader.encoding;
    }
    get isClosed() {
        return this.reader.isClosed;
    }
    get handle() {
        return this.reader.handle;
    }
    static create(filePath, preserveWhitespacesAndComments = true, chunkSize = 4096) {
        return __awaiter(this, void 0, void 0, function* () {
            const reader = yield wsv_io_1.WsvStreamReader.create(filePath, preserveWhitespacesAndComments, chunkSize);
            try {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const result = yield SmlEndKeywordDetector.getEndKeywordAndPosition(reader.handle, reader.encoding);
                const endKeyword = result[0];
                const iterator = yield WsvStreamLineIterator.create(reader, endKeyword);
                const emptyNodesBefore = [];
                const root = yield sml_1.SmlParser.readRootElement(iterator, emptyNodesBefore);
                return new SmlStreamReader(reader, root, endKeyword, iterator, preserveWhitespacesAndComments, emptyNodesBefore);
            }
            catch (error) {
                reader.close();
                throw error;
            }
        });
    }
    readNode() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.preserveWhitespacesAndComments) {
                for (;;) {
                    const result = yield sml_1.SmlParser.readNode(this.iterator, this.root);
                    if (result instanceof sml_1.SmlEmptyNode) {
                        continue;
                    }
                    return result;
                }
            }
            else {
                return yield sml_1.SmlParser.readNode(this.iterator, this.root);
            }
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.reader.close();
        });
    }
}
exports.SmlStreamReader = SmlStreamReader;
// ----------------------------------------------------------------------
class SmlEndKeywordDetector {
    static getEndKeywordAndPositionSync(handle, encoding) {
        try {
            let endKeyword;
            const iterator = new reliabletxt_io_1.SyncReverseLineIterator(handle, encoding);
            for (;;) {
                const lineStr = iterator.getLine();
                const line = wsv_1.WsvLine.parse(lineStr);
                if (line.hasValues) {
                    if (line.values.length > 1) {
                        throw new sml_1.SmlParserError(-1, "Invalid end line");
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
    static getEndKeywordAndPosition(handle, encoding) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let endKeyword;
                const iterator = yield reliabletxt_io_1.ReverseLineIterator.create(handle, encoding);
                for (;;) {
                    const lineStr = yield iterator.getLine();
                    const line = wsv_1.WsvLine.parse(lineStr);
                    if (line.hasValues) {
                        if (line.values.length > 1) {
                            throw new sml_1.SmlParserError(-1, "Invalid end line");
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
        });
    }
}
// ----------------------------------------------------------------------
class SyncSmlStreamWriter {
    constructor(templateDocument, filePath, preserveWhitespacesAndComment = true, append = false) {
        this.writer = new reliabletxt_io_1.SyncReliableTxtStreamWriter(filePath, templateDocument.encoding, append);
        try {
            this.preserveWhitespacesAndComments = preserveWhitespacesAndComment;
            this.defaultIndentation = templateDocument.defaultIndentation;
            if (this.writer.isAppendMode) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const handle = this.writer.handle;
                const result = SmlEndKeywordDetector.getEndKeywordAndPositionSync(handle, this.encoding);
                this.endKeyword = result[0];
                const restLength = result[1];
                this.writer.internalTruncate(restLength);
            }
            else {
                this.endKeyword = templateDocument.endKeyword;
                const rootElementName = templateDocument.root.name;
                this.writer.writeLine(wsv_1.WsvValue.serialize(rootElementName));
            }
        }
        catch (error) {
            this.writer.close();
            throw error;
        }
    }
    get encoding() {
        return this.writer.encoding;
    }
    get isClosed() {
        return this.writer.isClosed;
    }
    get handle() {
        return this.writer.handle;
    }
    get isAppendMode() {
        return this.writer.isAppendMode;
    }
    writeNode(node) {
        const lines = [];
        node.internalSerialize(lines, 1, this.defaultIndentation, this.endKeyword, this.preserveWhitespacesAndComments);
        this.writer.writeLines(lines);
    }
    close() {
        if (!this.writer.isClosed) {
            this.writer.writeLine(wsv_1.WsvValue.serialize(this.endKeyword));
            this.writer.close();
        }
    }
}
exports.SyncSmlStreamWriter = SyncSmlStreamWriter;
// ----------------------------------------------------------------------
class SmlStreamWriter {
    constructor(writer, defaultIndentation, preserveWhitespacesAndComment, endKeyword) {
        this.writer = writer;
        this.defaultIndentation = defaultIndentation;
        this.preserveWhitespacesAndComments = preserveWhitespacesAndComment;
        this.endKeyword = endKeyword;
    }
    get encoding() {
        return this.writer.encoding;
    }
    get isClosed() {
        return this.writer.isClosed;
    }
    get handle() {
        return this.writer.handle;
    }
    get isAppendMode() {
        return this.writer.isAppendMode;
    }
    static create(templateDocument, filePath, preserveWhitespacesAndComment = true, append = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const writer = yield reliabletxt_io_1.ReliableTxtStreamWriter.create(filePath, templateDocument.encoding, append);
            let endKeyword;
            try {
                if (writer.isAppendMode) {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    const handle = writer.handle;
                    const result = yield SmlEndKeywordDetector.getEndKeywordAndPosition(handle, writer.encoding);
                    endKeyword = result[0];
                    const restLength = result[1];
                    yield writer.internalTruncate(restLength);
                }
                else {
                    endKeyword = templateDocument.endKeyword;
                    const rootElementName = templateDocument.root.name;
                    yield writer.writeLine(wsv_1.WsvValue.serialize(rootElementName));
                }
            }
            catch (error) {
                yield writer.close();
                throw error;
            }
            return new SmlStreamWriter(writer, templateDocument.defaultIndentation, preserveWhitespacesAndComment, endKeyword);
        });
    }
    writeNode(node) {
        return __awaiter(this, void 0, void 0, function* () {
            const lines = [];
            node.internalSerialize(lines, 1, this.defaultIndentation, this.endKeyword, this.preserveWhitespacesAndComments);
            yield this.writer.writeLines(lines);
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.writer.isClosed) {
                yield this.writer.writeLine(wsv_1.WsvValue.serialize(this.endKeyword));
                yield this.writer.close();
            }
        });
    }
}
exports.SmlStreamWriter = SmlStreamWriter;
//# sourceMappingURL=sml-io.js.map