"use strict";
/* (C) Stefan John / Stenway / SimpleML.com / 2022 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncSmlStreamWriter = exports.SyncSmlStreamReader = exports.SyncWsvStreamLineIterator = exports.SmlFile = void 0;
const fs = __importStar(require("fs"));
const reliabletxt_io_1 = require("@stenway/reliabletxt-io");
const reliabletxt_1 = require("@stenway/reliabletxt");
const sml_1 = require("@stenway/sml");
const wsv_io_1 = require("@stenway/wsv-io");
const wsv_1 = require("@stenway/wsv");
// ----------------------------------------------------------------------
class SmlFile {
    static loadSync(filePath, preserveWhitespacesAndComments = true) {
        let reliableTxtDocument = reliabletxt_io_1.ReliableTxtFile.loadSync(filePath);
        let smlDocument = sml_1.SmlDocument.parse(reliableTxtDocument.text, preserveWhitespacesAndComments);
        smlDocument.encoding = reliableTxtDocument.encoding;
        return smlDocument;
    }
    static saveSync(document, filePath, preserveWhitespacesAndComments = true) {
        let text = document.toString(preserveWhitespacesAndComments);
        reliabletxt_io_1.ReliableTxtFile.writeAllTextSync(text, filePath, document.encoding);
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
        return this.hasLine() && !this.currentLine.hasValues;
    }
    getLine() {
        let result = this.currentLine;
        this.currentLine = this.reader.readLine();
        this.index++;
        return result;
    }
    getLineAsArray() {
        return this.getLine().values;
    }
    toString() {
        let result = "(" + this.index + "): ";
        if (this.hasLine()) {
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
class SyncSmlStreamReader {
    constructor(filePath, endKeyword = "End") {
        this.emptyNodesBefore = [];
        this.reader = new wsv_io_1.SyncWsvStreamReader(filePath);
        this.encoding = this.reader.encoding;
        this.endKeyword = endKeyword;
        this.iterator = new SyncWsvStreamLineIterator(this.reader, endKeyword);
        this.root = sml_1.SmlParser.readRootElement(this.iterator, this.emptyNodesBefore);
    }
    readNode() {
        return sml_1.SmlParser.readNode(this.iterator, this.root);
    }
    close() {
        this.reader.close();
    }
}
exports.SyncSmlStreamReader = SyncSmlStreamReader;
// ----------------------------------------------------------------------
class SmlFileAppend {
    static removeEnd(filePath, encoding) {
        let endKeyword;
        let iterator = new reliabletxt_io_1.ReverseLineIterator(filePath, encoding);
        while (true) {
            let lineStr = iterator.getLine();
            let line = wsv_1.WsvLine.parse(lineStr);
            if (line.hasValues) {
                if (line.values.length > 1) {
                    throw new sml_1.SmlParserError(-1, "Invalid end line");
                }
                endKeyword = line.values[0];
                break;
            }
        }
        let remainingLength = iterator.getPosition() + 1;
        iterator.close();
        fs.truncateSync(filePath, remainingLength);
        return endKeyword;
    }
}
// ----------------------------------------------------------------------
class SyncSmlStreamWriter {
    constructor(templateDocument, filePath, encoding = reliabletxt_1.ReliableTxtEncoding.Utf8, preserveWhitespacesAndComment = true, append = false) {
        this.endKeyword = "End";
        if (append) {
            if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
                append = false;
            }
        }
        this.writer = new reliabletxt_io_1.SyncReliableTxtStreamWriter(filePath, encoding, append);
        this.preserveWhitespacesAndComment = preserveWhitespacesAndComment;
        this.endKeyword = templateDocument.endKeyword;
        this.defaultIndentation = templateDocument.defaultIndentation;
        if (append) {
            this.endKeyword = SmlFileAppend.removeEnd(filePath, this.writer.encoding);
        }
        else {
            let rootElementName = templateDocument.root.name;
            this.writer.writeLine(wsv_1.WsvSerializer.serializeValue(rootElementName));
        }
    }
    get encoding() {
        return this.writer.encoding;
    }
    writeNode(node) {
        let lines = [];
        node.serialize(lines, 1, this.defaultIndentation, this.endKeyword, this.preserveWhitespacesAndComment);
        this.writer.writeLines(lines);
    }
    close() {
        if (this.writer.isClosed) {
            return;
        }
        this.writer.writeLine(wsv_1.WsvSerializer.serializeValue(this.endKeyword));
        this.writer.close();
    }
}
exports.SyncSmlStreamWriter = SyncSmlStreamWriter;
