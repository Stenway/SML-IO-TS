"use strict";
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
const reliabletxt_1 = require("@stenway/reliabletxt");
const reliabletxt_2 = require("@stenway/reliabletxt");
const reliabletxt_io_1 = require("@stenway/reliabletxt-io");
const sml_1 = require("@stenway/sml");
const wsv_io_1 = require("@stenway/wsv-io");
const fs = __importStar(require("fs"));
const src_1 = require("../src");
function getFilePath(name) {
    return "test_files/" + name;
}
const testFilePath = getFilePath("Test.sml");
function writeBytesSync(bytes, filePath) {
    fs.writeFileSync(filePath, bytes);
}
function writeBytes(bytes, filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        yield fs.promises.writeFile(filePath, bytes);
    });
}
function deleteFileSync(filePath) {
    try {
        fs.unlinkSync(filePath);
    }
    catch (_a) {
        return false;
    }
    return true;
}
function deleteFile(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield fs.promises.unlink(filePath);
        }
        catch (_a) {
            return false;
        }
        return true;
    });
}
// ----------------------------------------------------------------------
describe("SmlFile.saveSync + loadSync", () => {
    test.each([
        [reliabletxt_2.ReliableTxtEncoding.Utf8],
        [reliabletxt_2.ReliableTxtEncoding.Utf16],
        [reliabletxt_2.ReliableTxtEncoding.Utf16Reverse],
        [reliabletxt_2.ReliableTxtEncoding.Utf32],
    ])("Given %p", (encoding) => {
        const document = sml_1.SmlDocument.parse(" Root  \n Attribute 1 2  # c\n #c\n End");
        document.encoding = encoding;
        src_1.SmlFile.saveSync(document, testFilePath);
        let loadedDocument = src_1.SmlFile.loadSync(testFilePath);
        expect(loadedDocument.toString()).toEqual(document.toString());
        expect(loadedDocument.encoding).toEqual(document.encoding);
        loadedDocument = src_1.SmlFile.loadSync(testFilePath, false);
        expect(loadedDocument.toString()).toEqual("Root\n\tAttribute 1 2\nEnd");
        expect(loadedDocument.encoding).toEqual(document.encoding);
        src_1.SmlFile.saveSync(document, testFilePath, false);
        loadedDocument = src_1.SmlFile.loadSync(testFilePath, true);
        expect(loadedDocument.toString()).toEqual("Root\n\tAttribute 1 2\nEnd");
        expect(loadedDocument.encoding).toEqual(document.encoding);
    });
    test("Throws", () => {
        writeBytesSync(new Uint8Array([]), testFilePath);
        expect(() => src_1.SmlFile.loadSync(testFilePath)).toThrowError(reliabletxt_1.NoReliableTxtPreambleError);
    });
});
describe("SmlFile.save + load", () => {
    test.each([
        [reliabletxt_2.ReliableTxtEncoding.Utf8],
        [reliabletxt_2.ReliableTxtEncoding.Utf16],
        [reliabletxt_2.ReliableTxtEncoding.Utf16Reverse],
        [reliabletxt_2.ReliableTxtEncoding.Utf32],
    ])("Given %p", (encoding) => __awaiter(void 0, void 0, void 0, function* () {
        const document = sml_1.SmlDocument.parse(" Root  \n Attribute 1 2  # c\n #c\n End");
        document.encoding = encoding;
        yield src_1.SmlFile.save(document, testFilePath);
        let loadedDocument = yield src_1.SmlFile.load(testFilePath);
        expect(loadedDocument.toString()).toEqual(document.toString());
        expect(loadedDocument.encoding).toEqual(document.encoding);
        loadedDocument = yield src_1.SmlFile.load(testFilePath, false);
        expect(loadedDocument.toString()).toEqual("Root\n\tAttribute 1 2\nEnd");
        expect(loadedDocument.encoding).toEqual(document.encoding);
        yield src_1.SmlFile.save(document, testFilePath, false);
        loadedDocument = yield src_1.SmlFile.load(testFilePath, true);
        expect(loadedDocument.toString()).toEqual("Root\n\tAttribute 1 2\nEnd");
        expect(loadedDocument.encoding).toEqual(document.encoding);
    }));
    test("Throws", () => __awaiter(void 0, void 0, void 0, function* () {
        yield writeBytes(new Uint8Array([]), testFilePath);
        yield expect(() => __awaiter(void 0, void 0, void 0, function* () { return yield src_1.SmlFile.load(testFilePath); })).rejects.toThrowError(reliabletxt_1.NoReliableTxtPreambleError);
    }));
});
describe("SmlFile.appendNodesSync", () => {
    test("Utf8", () => {
        reliabletxt_io_1.ReliableTxtFile.writeAllTextSync("Root\nEnd", testFilePath);
        const template = new sml_1.SmlDocument(new sml_1.SmlElement("Root"));
        src_1.SmlFile.appendNodesSync([new sml_1.SmlAttribute("Attribute1"), new sml_1.SmlAttribute("Attribute2")], template, testFilePath);
        src_1.SmlFile.appendNodesSync([], template, testFilePath);
        expect(reliabletxt_io_1.ReliableTxtFile.readAllTextSync(testFilePath)).toEqual("Root\n\tAttribute1 -\n\tAttribute2 -\nEnd");
    });
    test("Throws", () => {
        writeBytesSync(new Uint8Array([]), testFilePath);
        const template = new sml_1.SmlDocument(new sml_1.SmlElement("Root"));
        expect(() => src_1.SmlFile.appendNodesSync([new sml_1.SmlAttribute("Attribute1")], template, testFilePath)).toThrowError(reliabletxt_1.NoReliableTxtPreambleError);
    });
});
describe("SmlFile.appendNodes", () => {
    test("Utf8", () => __awaiter(void 0, void 0, void 0, function* () {
        yield reliabletxt_io_1.ReliableTxtFile.writeAllText("Root\nEnd", testFilePath);
        const template = new sml_1.SmlDocument(new sml_1.SmlElement("Root"));
        yield src_1.SmlFile.appendNodes([new sml_1.SmlAttribute("Attribute1"), new sml_1.SmlAttribute("Attribute2")], template, testFilePath);
        yield src_1.SmlFile.appendNodes([], template, testFilePath);
        expect(yield reliabletxt_io_1.ReliableTxtFile.readAllText(testFilePath)).toEqual("Root\n\tAttribute1 -\n\tAttribute2 -\nEnd");
    }));
    test("Throws", () => __awaiter(void 0, void 0, void 0, function* () {
        yield writeBytes(new Uint8Array([]), testFilePath);
        const template = new sml_1.SmlDocument(new sml_1.SmlElement("Root"));
        yield expect(() => __awaiter(void 0, void 0, void 0, function* () { return yield src_1.SmlFile.appendNodes([new sml_1.SmlAttribute("Attribute1")], template, testFilePath); })).rejects.toThrowError(reliabletxt_1.NoReliableTxtPreambleError);
    }));
});
// ----------------------------------------------------------------------
describe("SyncSmlStreamReader Constructor", () => {
    test.each([
        ["Root\nEnd", "End"],
        ["Root\nend", "end"],
        ["Root\n-", null],
        ["契約\nエンド", "エンド"],
        ["Root\nEnd  ", "End"],
        ["Root\n  End  \n", "End"],
        ["Root\n  End  \n  \n  ", "End"],
    ])("Given %p", (input, output) => {
        reliabletxt_io_1.ReliableTxtFile.writeAllTextSync(input, testFilePath, reliabletxt_2.ReliableTxtEncoding.Utf8);
        const reader = new src_1.SyncSmlStreamReader(testFilePath);
        expect(reader.encoding).toEqual(reliabletxt_2.ReliableTxtEncoding.Utf8);
        expect(reader.endKeyword).toEqual(output);
        expect(reader.handle !== null).toEqual(true);
        reader.close();
    });
    test.each([
        [reliabletxt_2.ReliableTxtEncoding.Utf16],
        [reliabletxt_2.ReliableTxtEncoding.Utf16Reverse],
        [reliabletxt_2.ReliableTxtEncoding.Utf32],
    ])("Given %p throws", (encoding) => {
        reliabletxt_io_1.ReliableTxtFile.writeAllTextSync("Root\nEnd", testFilePath, encoding);
        expect(() => new src_1.SyncSmlStreamReader(testFilePath)).toThrowError();
    });
    test("Invalid end keyword", () => {
        reliabletxt_io_1.ReliableTxtFile.writeAllTextSync("Root\nEnd End", testFilePath, reliabletxt_2.ReliableTxtEncoding.Utf8);
        expect(() => new src_1.SyncSmlStreamReader(testFilePath)).toThrowError();
    });
    test("Chunk size", () => {
        reliabletxt_io_1.ReliableTxtFile.writeAllTextSync("Root\nEnd", testFilePath, reliabletxt_2.ReliableTxtEncoding.Utf8);
        expect(() => new src_1.SyncSmlStreamReader(testFilePath, true, 1)).toThrowError("Chunk size too small");
    });
});
test("SyncSmlStreamReader.isClosed", () => {
    reliabletxt_io_1.ReliableTxtFile.writeAllTextSync("Root\nEnd", testFilePath, reliabletxt_2.ReliableTxtEncoding.Utf8);
    const writer = new src_1.SyncSmlStreamReader(testFilePath);
    expect(writer.isClosed).toEqual(false);
    writer.close();
    expect(writer.isClosed).toEqual(true);
});
describe("SyncSmlStreamReader.readLine", () => {
    test("Null", () => {
        reliabletxt_io_1.ReliableTxtFile.writeAllTextSync("Root\n\tAttribute1 10\n\tSub\n\tEnd\n\t#comment\nEnd", testFilePath);
        const reader = new src_1.SyncSmlStreamReader(testFilePath);
        const line1 = reader.readNode();
        if (line1 === null) {
            throw Error();
        }
        expect(line1.toString()).toEqual("\tAttribute1 10");
        const line2 = reader.readNode();
        if (line2 === null) {
            throw Error();
        }
        expect(line2.toString()).toEqual("\tSub\n\tEnd");
        const line3 = reader.readNode();
        if (line3 === null) {
            throw Error();
        }
        expect(line3.toString()).toEqual("\t#comment");
        expect(reader.readNode()).toEqual(null);
        reader.close();
    });
    test("Not preserving", () => {
        reliabletxt_io_1.ReliableTxtFile.writeAllTextSync("Root\n\tAttribute1 10\n\tSub\n\tEnd\n\t#comment\nEnd", testFilePath);
        const reader = new src_1.SyncSmlStreamReader(testFilePath, false);
        const line1 = reader.readNode();
        if (line1 === null) {
            throw Error();
        }
        expect(line1.toString()).toEqual("Attribute1 10");
        const line2 = reader.readNode();
        if (line2 === null) {
            throw Error();
        }
        expect(line2.toString()).toEqual("Sub\nEnd");
        expect(reader.readNode()).toEqual(null);
        reader.close();
    });
    test("Closed", () => {
        reliabletxt_io_1.ReliableTxtFile.writeAllTextSync("Root\nEnd", testFilePath);
        const reader = new src_1.SyncSmlStreamReader(testFilePath);
        reader.close();
        expect(() => reader.readNode()).toThrowError();
    });
});
// ----------------------------------------------------------------------
test("SyncWsvStreamLineIterator", () => {
    reliabletxt_io_1.ReliableTxtFile.writeAllTextSync("Root\nEnd", testFilePath);
    const reader = new wsv_io_1.SyncWsvStreamReader(testFilePath);
    const iterator = new src_1.SyncWsvStreamLineIterator(reader, "End");
    expect(iterator.getLineAsArray()).toEqual(["Root"]);
    expect(iterator.toString()).toEqual("(2): End");
    expect(iterator.getLineIndex()).toEqual(1);
    expect(iterator.getLine().toString()).toEqual("End");
    expect(iterator.hasLine()).toEqual(false);
    expect(() => iterator.getLine()).toThrowError();
    expect(() => iterator.isEmptyLine()).toThrowError();
    reader.close();
});
// ----------------------------------------------------------------------
describe("SmlStreamReader Constructor", () => {
    test.each([
        ["Root\nEnd", "End"],
        ["Root\nend", "end"],
        ["Root\n-", null],
        ["契約\nエンド", "エンド"],
        ["Root\nEnd  ", "End"],
        ["Root\n  End  \n", "End"],
        ["Root\n  End  \n  \n  ", "End"],
    ])("Given %p", (input, output) => __awaiter(void 0, void 0, void 0, function* () {
        yield reliabletxt_io_1.ReliableTxtFile.writeAllText(input, testFilePath, reliabletxt_2.ReliableTxtEncoding.Utf8);
        const reader = yield src_1.SmlStreamReader.create(testFilePath);
        expect(reader.encoding).toEqual(reliabletxt_2.ReliableTxtEncoding.Utf8);
        expect(reader.endKeyword).toEqual(output);
        expect(reader.handle !== null).toEqual(true);
        yield reader.close();
    }));
    test.each([
        [reliabletxt_2.ReliableTxtEncoding.Utf16],
        [reliabletxt_2.ReliableTxtEncoding.Utf16Reverse],
        [reliabletxt_2.ReliableTxtEncoding.Utf32],
    ])("Given %p throws", (encoding) => __awaiter(void 0, void 0, void 0, function* () {
        yield reliabletxt_io_1.ReliableTxtFile.writeAllText("Root\nEnd", testFilePath, encoding);
        yield expect(() => __awaiter(void 0, void 0, void 0, function* () { return yield src_1.SmlStreamReader.create(testFilePath); })).rejects.toThrowError();
    }));
    test("Invalid end keyword", () => __awaiter(void 0, void 0, void 0, function* () {
        yield reliabletxt_io_1.ReliableTxtFile.writeAllText("Root\nEnd End", testFilePath, reliabletxt_2.ReliableTxtEncoding.Utf8);
        yield expect(() => __awaiter(void 0, void 0, void 0, function* () { return yield src_1.SmlStreamReader.create(testFilePath); })).rejects.toThrowError();
    }));
    test("Chunk size", () => __awaiter(void 0, void 0, void 0, function* () {
        yield reliabletxt_io_1.ReliableTxtFile.writeAllText("Root\nEnd", testFilePath, reliabletxt_2.ReliableTxtEncoding.Utf8);
        yield expect(() => __awaiter(void 0, void 0, void 0, function* () { return yield src_1.SmlStreamReader.create(testFilePath, true, 1); })).rejects.toThrowError("Chunk size too small");
    }));
});
test("SmlStreamReader.isClosed", () => __awaiter(void 0, void 0, void 0, function* () {
    yield reliabletxt_io_1.ReliableTxtFile.writeAllText("Root\nEnd", testFilePath, reliabletxt_2.ReliableTxtEncoding.Utf8);
    const writer = yield src_1.SmlStreamReader.create(testFilePath);
    expect(writer.isClosed).toEqual(false);
    yield writer.close();
    expect(writer.isClosed).toEqual(true);
}));
describe("SmlStreamReader.readLine", () => {
    test("Null", () => __awaiter(void 0, void 0, void 0, function* () {
        yield reliabletxt_io_1.ReliableTxtFile.writeAllText("Root\n\tAttribute1 10\n\tSub\n\tEnd\n\t#comment\nEnd", testFilePath);
        const reader = yield src_1.SmlStreamReader.create(testFilePath);
        const line1 = yield reader.readNode();
        if (line1 === null) {
            throw Error();
        }
        expect(line1.toString()).toEqual("\tAttribute1 10");
        const line2 = yield reader.readNode();
        if (line2 === null) {
            throw Error();
        }
        expect(line2.toString()).toEqual("\tSub\n\tEnd");
        const line3 = yield reader.readNode();
        if (line3 === null) {
            throw Error();
        }
        expect(line3.toString()).toEqual("\t#comment");
        expect(yield reader.readNode()).toEqual(null);
        yield reader.close();
    }));
    test("Not preserving", () => __awaiter(void 0, void 0, void 0, function* () {
        yield reliabletxt_io_1.ReliableTxtFile.writeAllText("Root\n\tAttribute1 10\n\tSub\n\tEnd\n\t#comment\nEnd", testFilePath);
        const reader = yield src_1.SmlStreamReader.create(testFilePath, false);
        const line1 = yield reader.readNode();
        if (line1 === null) {
            throw Error();
        }
        expect(line1.toString()).toEqual("Attribute1 10");
        const line2 = yield reader.readNode();
        if (line2 === null) {
            throw Error();
        }
        expect(line2.toString()).toEqual("Sub\nEnd");
        expect(yield reader.readNode()).toEqual(null);
        yield reader.close();
    }));
    test("Closed", () => __awaiter(void 0, void 0, void 0, function* () {
        yield reliabletxt_io_1.ReliableTxtFile.writeAllText("Root\nEnd", testFilePath);
        const reader = yield src_1.SmlStreamReader.create(testFilePath);
        yield reader.close();
        yield expect(() => __awaiter(void 0, void 0, void 0, function* () { return yield reader.readNode(); })).rejects.toThrowError();
    }));
});
// ----------------------------------------------------------------------
test("WsvStreamLineIterator", () => __awaiter(void 0, void 0, void 0, function* () {
    yield reliabletxt_io_1.ReliableTxtFile.writeAllText("Root\nEnd", testFilePath);
    const reader = yield wsv_io_1.WsvStreamReader.create(testFilePath);
    const iterator = yield src_1.WsvStreamLineIterator.create(reader, "End");
    expect(yield iterator.getLineAsArray()).toEqual(["Root"]);
    expect(iterator.toString()).toEqual("(2): End");
    expect(iterator.getLineIndex()).toEqual(1);
    expect((yield iterator.getLine()).toString()).toEqual("End");
    expect(yield iterator.hasLine()).toEqual(false);
    yield expect(() => __awaiter(void 0, void 0, void 0, function* () { return yield iterator.getLine(); })).rejects.toThrowError();
    yield expect(() => __awaiter(void 0, void 0, void 0, function* () { return yield iterator.isEmptyLine(); })).rejects.toThrowError();
    yield reader.close();
}));
// ----------------------------------------------------------------------
describe("SyncSmlStreamWriter Constructor", () => {
    test("Test", () => {
        deleteFileSync(testFilePath);
        const template = new sml_1.SmlDocument(new sml_1.SmlElement("Root"));
        const writer = new src_1.SyncSmlStreamWriter(template, testFilePath);
        expect(writer.isAppendMode).toEqual(false);
        expect(writer.isClosed).toEqual(false);
        expect(writer.handle !== null).toEqual(true);
        expect(writer.encoding).toEqual(reliabletxt_2.ReliableTxtEncoding.Utf8);
        writer.writeNode(new sml_1.SmlAttribute("Attribute1"));
        writer.close();
        expect(writer.isClosed).toEqual(true);
        expect(writer.handle === null).toEqual(true);
        const loaded = reliabletxt_io_1.ReliableTxtFile.loadSync(testFilePath);
        expect(loaded.text).toEqual("Root\n\tAttribute1 -\nEnd");
        expect(loaded.encoding).toEqual(reliabletxt_2.ReliableTxtEncoding.Utf8);
        const template2 = new sml_1.SmlDocument(new sml_1.SmlElement("Root2"));
        const writer2 = new src_1.SyncSmlStreamWriter(template2, testFilePath);
        expect(writer2.isAppendMode).toEqual(false);
        writer2.writeNode(new sml_1.SmlAttribute("Attribute1"));
        writer2.close();
        const loaded2 = reliabletxt_io_1.ReliableTxtFile.loadSync(testFilePath);
        expect(loaded2.text).toEqual("Root2\n\tAttribute1 -\nEnd");
        expect(loaded2.encoding).toEqual(reliabletxt_2.ReliableTxtEncoding.Utf8);
        const writer3 = new src_1.SyncSmlStreamWriter(template2, testFilePath, true, true);
        expect(writer3.isAppendMode).toEqual(true);
        writer3.writeNode(new sml_1.SmlAttribute("Attribute2"));
        writer3.close();
        const loaded3 = reliabletxt_io_1.ReliableTxtFile.loadSync(testFilePath);
        expect(loaded3.text).toEqual("Root2\n\tAttribute1 -\n\tAttribute2 -\nEnd");
        expect(loaded3.encoding).toEqual(reliabletxt_2.ReliableTxtEncoding.Utf8);
        deleteFileSync(testFilePath);
        const writer4 = new src_1.SyncSmlStreamWriter(template, testFilePath, true, true);
        expect(writer4.isAppendMode).toEqual(false);
        writer4.close();
        const loaded4 = reliabletxt_io_1.ReliableTxtFile.loadSync(testFilePath);
        expect(loaded4.text).toEqual("Root\nEnd");
        expect(loaded4.encoding).toEqual(reliabletxt_2.ReliableTxtEncoding.Utf8);
    });
    test("Invalid end keyword", () => {
        reliabletxt_io_1.ReliableTxtFile.writeAllTextSync("Root\nEnd End", testFilePath, reliabletxt_2.ReliableTxtEncoding.Utf8);
        const template = new sml_1.SmlDocument(new sml_1.SmlElement("Root"));
        expect(() => new src_1.SyncSmlStreamWriter(template, testFilePath, true, true)).toThrowError();
    });
});
// ----------------------------------------------------------------------
describe("SmlStreamWriter Constructor", () => {
    test("Test", () => __awaiter(void 0, void 0, void 0, function* () {
        yield deleteFile(testFilePath);
        const template = new sml_1.SmlDocument(new sml_1.SmlElement("Root"));
        const writer = yield src_1.SmlStreamWriter.create(template, testFilePath);
        expect(writer.isAppendMode).toEqual(false);
        expect(writer.isClosed).toEqual(false);
        expect(writer.handle !== null).toEqual(true);
        expect(writer.encoding).toEqual(reliabletxt_2.ReliableTxtEncoding.Utf8);
        yield writer.writeNode(new sml_1.SmlAttribute("Attribute1"));
        yield writer.close();
        expect(writer.isClosed).toEqual(true);
        expect(writer.handle === null).toEqual(true);
        const loaded = yield reliabletxt_io_1.ReliableTxtFile.load(testFilePath);
        expect(loaded.text).toEqual("Root\n\tAttribute1 -\nEnd");
        expect(loaded.encoding).toEqual(reliabletxt_2.ReliableTxtEncoding.Utf8);
        const template2 = new sml_1.SmlDocument(new sml_1.SmlElement("Root2"));
        const writer2 = yield src_1.SmlStreamWriter.create(template2, testFilePath);
        expect(writer2.isAppendMode).toEqual(false);
        yield writer2.writeNode(new sml_1.SmlAttribute("Attribute1"));
        yield writer2.close();
        const loaded2 = yield reliabletxt_io_1.ReliableTxtFile.load(testFilePath);
        expect(loaded2.text).toEqual("Root2\n\tAttribute1 -\nEnd");
        expect(loaded2.encoding).toEqual(reliabletxt_2.ReliableTxtEncoding.Utf8);
        const writer3 = yield src_1.SmlStreamWriter.create(template2, testFilePath, true, true);
        expect(writer3.isAppendMode).toEqual(true);
        yield writer3.writeNode(new sml_1.SmlAttribute("Attribute2"));
        yield writer3.close();
        const loaded3 = yield reliabletxt_io_1.ReliableTxtFile.load(testFilePath);
        expect(loaded3.text).toEqual("Root2\n\tAttribute1 -\n\tAttribute2 -\nEnd");
        expect(loaded3.encoding).toEqual(reliabletxt_2.ReliableTxtEncoding.Utf8);
        yield deleteFile(testFilePath);
        const writer4 = yield src_1.SmlStreamWriter.create(template, testFilePath, true, true);
        expect(writer4.isAppendMode).toEqual(false);
        yield writer4.close();
        const loaded4 = yield reliabletxt_io_1.ReliableTxtFile.load(testFilePath);
        expect(loaded4.text).toEqual("Root\nEnd");
        expect(loaded4.encoding).toEqual(reliabletxt_2.ReliableTxtEncoding.Utf8);
    }));
    test("Invalid end keyword", () => __awaiter(void 0, void 0, void 0, function* () {
        yield reliabletxt_io_1.ReliableTxtFile.writeAllText("Root\nEnd End", testFilePath, reliabletxt_2.ReliableTxtEncoding.Utf8);
        const template = new sml_1.SmlDocument(new sml_1.SmlElement("Root"));
        yield expect(() => __awaiter(void 0, void 0, void 0, function* () { return yield src_1.SmlStreamWriter.create(template, testFilePath, true, true); })).rejects.toThrowError();
    }));
});
//# sourceMappingURL=sml-io.test.js.map