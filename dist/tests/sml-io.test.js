import { NoReliableTxtPreambleError } from '@stenway/reliabletxt';
import { ReliableTxtEncoding } from '@stenway/reliabletxt';
import { ReliableTxtFile, WriterMode } from '@stenway/reliabletxt-io';
import { SmlAttribute, SmlDocument, SmlElement } from '@stenway/sml';
import { SyncWsvStreamReader, WsvStreamReader } from '@stenway/wsv-io';
import * as fs from 'node:fs';
import { SmlFile, SmlStreamReader, SmlStreamWriter, SyncSmlStreamReader, SyncSmlStreamWriter, SyncWsvStreamLineIterator, WsvStreamLineIterator } from '../src/sml-io.js';
function getFilePath(name) {
    return "test_files/" + name;
}
const testFilePath = getFilePath("Test.sml");
function writeBytesSync(bytes, filePath) {
    fs.writeFileSync(filePath, bytes);
}
async function writeBytes(bytes, filePath) {
    await fs.promises.writeFile(filePath, bytes);
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
async function deleteFile(filePath) {
    try {
        await fs.promises.unlink(filePath);
    }
    catch (_a) {
        return false;
    }
    return true;
}
// ----------------------------------------------------------------------
describe("SmlFile.saveSync + loadSync", () => {
    test.each([
        [ReliableTxtEncoding.Utf8],
        [ReliableTxtEncoding.Utf16],
        [ReliableTxtEncoding.Utf16Reverse],
        [ReliableTxtEncoding.Utf32],
    ])("Given %p", (encoding) => {
        const document = SmlDocument.parse(" Root  \n Attribute 1 2  # c\n #c\n End");
        document.encoding = encoding;
        SmlFile.saveSync(document, testFilePath);
        let loadedDocument = SmlFile.loadSync(testFilePath);
        expect(loadedDocument.toString()).toEqual(document.toString());
        expect(loadedDocument.encoding).toEqual(document.encoding);
        loadedDocument = SmlFile.loadSync(testFilePath, false);
        expect(loadedDocument.toString()).toEqual("Root\n\tAttribute 1 2\nEnd");
        expect(loadedDocument.encoding).toEqual(document.encoding);
        SmlFile.saveSync(document, testFilePath, false);
        loadedDocument = SmlFile.loadSync(testFilePath, true);
        expect(loadedDocument.toString()).toEqual("Root\n\tAttribute 1 2\nEnd");
        expect(loadedDocument.encoding).toEqual(document.encoding);
    });
    test("Throws", () => {
        writeBytesSync(new Uint8Array([]), testFilePath);
        expect(() => SmlFile.loadSync(testFilePath)).toThrowError(NoReliableTxtPreambleError);
    });
});
describe("SmlFile.save + load", () => {
    test.each([
        [ReliableTxtEncoding.Utf8],
        [ReliableTxtEncoding.Utf16],
        [ReliableTxtEncoding.Utf16Reverse],
        [ReliableTxtEncoding.Utf32],
    ])("Given %p", async (encoding) => {
        const document = SmlDocument.parse(" Root  \n Attribute 1 2  # c\n #c\n End");
        document.encoding = encoding;
        await SmlFile.save(document, testFilePath);
        let loadedDocument = await SmlFile.load(testFilePath);
        expect(loadedDocument.toString()).toEqual(document.toString());
        expect(loadedDocument.encoding).toEqual(document.encoding);
        loadedDocument = await SmlFile.load(testFilePath, false);
        expect(loadedDocument.toString()).toEqual("Root\n\tAttribute 1 2\nEnd");
        expect(loadedDocument.encoding).toEqual(document.encoding);
        await SmlFile.save(document, testFilePath, false);
        loadedDocument = await SmlFile.load(testFilePath, true);
        expect(loadedDocument.toString()).toEqual("Root\n\tAttribute 1 2\nEnd");
        expect(loadedDocument.encoding).toEqual(document.encoding);
    });
    test("Throws", async () => {
        await writeBytes(new Uint8Array([]), testFilePath);
        await expect(async () => await SmlFile.load(testFilePath)).rejects.toThrowError(NoReliableTxtPreambleError);
    });
});
describe("SmlFile.appendNodesSync", () => {
    test("Utf8", () => {
        ReliableTxtFile.writeAllTextSync("Root\nEnd", testFilePath);
        const template = new SmlDocument(new SmlElement("Root"));
        SmlFile.appendNodesSync([new SmlAttribute("Attribute1"), new SmlAttribute("Attribute2")], template, testFilePath);
        SmlFile.appendNodesSync([], template, testFilePath);
        expect(ReliableTxtFile.readAllTextSync(testFilePath)).toEqual("Root\n\tAttribute1 -\n\tAttribute2 -\nEnd");
    });
    test("Throws", () => {
        writeBytesSync(new Uint8Array([]), testFilePath);
        const template = new SmlDocument(new SmlElement("Root"));
        expect(() => SmlFile.appendNodesSync([new SmlAttribute("Attribute1")], template, testFilePath)).toThrowError(NoReliableTxtPreambleError);
    });
});
describe("SmlFile.appendNodes", () => {
    test("Utf8", async () => {
        await ReliableTxtFile.writeAllText("Root\nEnd", testFilePath);
        const template = new SmlDocument(new SmlElement("Root"));
        await SmlFile.appendNodes([new SmlAttribute("Attribute1"), new SmlAttribute("Attribute2")], template, testFilePath);
        await SmlFile.appendNodes([], template, testFilePath);
        expect(await ReliableTxtFile.readAllText(testFilePath)).toEqual("Root\n\tAttribute1 -\n\tAttribute2 -\nEnd");
    });
    test("Throws", async () => {
        await writeBytes(new Uint8Array([]), testFilePath);
        const template = new SmlDocument(new SmlElement("Root"));
        await expect(async () => await SmlFile.appendNodes([new SmlAttribute("Attribute1")], template, testFilePath)).rejects.toThrowError(NoReliableTxtPreambleError);
    });
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
        ReliableTxtFile.writeAllTextSync(input, testFilePath, ReliableTxtEncoding.Utf8);
        const reader = SyncSmlStreamReader.create(testFilePath);
        expect(reader.encoding).toEqual(ReliableTxtEncoding.Utf8);
        expect(reader.endKeyword).toEqual(output);
        expect(reader.handle.encoding).toEqual(ReliableTxtEncoding.Utf8);
        reader.close();
    });
    test.each([
        [ReliableTxtEncoding.Utf16],
        [ReliableTxtEncoding.Utf16Reverse],
        [ReliableTxtEncoding.Utf32],
    ])("Given %p throws", (encoding) => {
        ReliableTxtFile.writeAllTextSync("Root\nEnd", testFilePath, encoding);
        expect(() => SyncSmlStreamReader.create(testFilePath)).toThrowError();
    });
    test("Invalid end keyword", () => {
        ReliableTxtFile.writeAllTextSync("Root\nEnd End", testFilePath, ReliableTxtEncoding.Utf8);
        expect(() => SyncSmlStreamReader.create(testFilePath)).toThrowError();
    });
    test("Chunk size", () => {
        ReliableTxtFile.writeAllTextSync("Root\nEnd", testFilePath, ReliableTxtEncoding.Utf8);
        expect(() => SyncSmlStreamReader.create(testFilePath, true, 1)).toThrowError("Chunk size too small");
    });
});
test("SyncSmlStreamReader.isClosed", () => {
    ReliableTxtFile.writeAllTextSync("Root\nEnd", testFilePath, ReliableTxtEncoding.Utf8);
    const writer = SyncSmlStreamReader.create(testFilePath);
    expect(writer.isClosed).toEqual(false);
    writer.close();
    expect(writer.isClosed).toEqual(true);
});
describe("SyncSmlStreamReader.readLine", () => {
    test("Null", () => {
        ReliableTxtFile.writeAllTextSync("Root\n\tAttribute1 10\n\tSub\n\tEnd\n\t#comment\nEnd", testFilePath);
        const reader = SyncSmlStreamReader.create(testFilePath);
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
        expect(reader.readNode()).toEqual(null);
        reader.close();
    });
    test("Not preserving", () => {
        ReliableTxtFile.writeAllTextSync("Root\n\tAttribute1 10\n\tSub\n\tEnd\n\t#comment\nEnd", testFilePath);
        const reader = SyncSmlStreamReader.create(testFilePath, false);
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
        ReliableTxtFile.writeAllTextSync("Root\nEnd", testFilePath);
        const reader = SyncSmlStreamReader.create(testFilePath);
        reader.close();
        expect(() => reader.readNode()).toThrowError();
    });
});
// ----------------------------------------------------------------------
test("SyncWsvStreamLineIterator", () => {
    ReliableTxtFile.writeAllTextSync("Root\nEnd", testFilePath);
    const reader = SyncWsvStreamReader.create(testFilePath);
    const iterator = SyncWsvStreamLineIterator.create(reader, "End");
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
    ])("Given %p", async (input, output) => {
        await ReliableTxtFile.writeAllText(input, testFilePath, ReliableTxtEncoding.Utf8);
        const reader = await SmlStreamReader.create(testFilePath);
        expect(reader.encoding).toEqual(ReliableTxtEncoding.Utf8);
        expect(reader.endKeyword).toEqual(output);
        expect(reader.handle.encoding).toEqual(ReliableTxtEncoding.Utf8);
        await reader.close();
    });
    test.each([
        [ReliableTxtEncoding.Utf16],
        [ReliableTxtEncoding.Utf16Reverse],
        [ReliableTxtEncoding.Utf32],
    ])("Given %p throws", async (encoding) => {
        await ReliableTxtFile.writeAllText("Root\nEnd", testFilePath, encoding);
        await expect(async () => await SmlStreamReader.create(testFilePath)).rejects.toThrowError();
    });
    test("Invalid end keyword", async () => {
        await ReliableTxtFile.writeAllText("Root\nEnd End", testFilePath, ReliableTxtEncoding.Utf8);
        await expect(async () => await SmlStreamReader.create(testFilePath)).rejects.toThrowError();
    });
    test("Chunk size", async () => {
        await ReliableTxtFile.writeAllText("Root\nEnd", testFilePath, ReliableTxtEncoding.Utf8);
        await expect(async () => await SmlStreamReader.create(testFilePath, true, 1)).rejects.toThrowError("Chunk size too small");
    });
});
test("SmlStreamReader.isClosed", async () => {
    await ReliableTxtFile.writeAllText("Root\nEnd", testFilePath, ReliableTxtEncoding.Utf8);
    const writer = await SmlStreamReader.create(testFilePath);
    expect(writer.isClosed).toEqual(false);
    await writer.close();
    expect(writer.isClosed).toEqual(true);
});
describe("SmlStreamReader.readLine", () => {
    test("Null", async () => {
        await ReliableTxtFile.writeAllText("Root\n\tAttribute1 10\n\tSub\n\tEnd\n\t#comment\nEnd", testFilePath);
        const reader = await SmlStreamReader.create(testFilePath);
        const line1 = await reader.readNode();
        if (line1 === null) {
            throw Error();
        }
        expect(line1.toString()).toEqual("\tAttribute1 10");
        const line2 = await reader.readNode();
        if (line2 === null) {
            throw Error();
        }
        expect(line2.toString()).toEqual("\tSub\n\tEnd");
        const line3 = await reader.readNode();
        if (line3 === null) {
            throw Error();
        }
        expect(line3.toString()).toEqual("\t#comment");
        expect(await reader.readNode()).toEqual(null);
        expect(await reader.readNode()).toEqual(null);
        await reader.close();
    });
    test("Not preserving", async () => {
        await ReliableTxtFile.writeAllText("Root\n\tAttribute1 10\n\tSub\n\tEnd\n\t#comment\nEnd", testFilePath);
        const reader = await SmlStreamReader.create(testFilePath, false);
        const line1 = await reader.readNode();
        if (line1 === null) {
            throw Error();
        }
        expect(line1.toString()).toEqual("Attribute1 10");
        const line2 = await reader.readNode();
        if (line2 === null) {
            throw Error();
        }
        expect(line2.toString()).toEqual("Sub\nEnd");
        expect(await reader.readNode()).toEqual(null);
        await reader.close();
    });
    test("Closed", async () => {
        await ReliableTxtFile.writeAllText("Root\nEnd", testFilePath);
        const reader = await SmlStreamReader.create(testFilePath);
        await reader.close();
        await expect(async () => await reader.readNode()).rejects.toThrowError();
    });
});
// ----------------------------------------------------------------------
test("WsvStreamLineIterator", async () => {
    await ReliableTxtFile.writeAllText("Root\nEnd", testFilePath);
    const reader = await WsvStreamReader.create(testFilePath);
    const iterator = await WsvStreamLineIterator.create(reader, "End");
    expect(await iterator.getLineAsArray()).toEqual(["Root"]);
    expect(iterator.toString()).toEqual("(2): End");
    expect(iterator.getLineIndex()).toEqual(1);
    expect((await iterator.getLine()).toString()).toEqual("End");
    expect(await iterator.hasLine()).toEqual(false);
    await expect(async () => await iterator.getLine()).rejects.toThrowError();
    await expect(async () => await iterator.isEmptyLine()).rejects.toThrowError();
    await reader.close();
});
// ----------------------------------------------------------------------
describe("SyncSmlStreamWriter Constructor", () => {
    test("Test", () => {
        deleteFileSync(testFilePath);
        const template = new SmlDocument(new SmlElement("Root"));
        const writer = SyncSmlStreamWriter.create(template, testFilePath);
        expect(writer.existing).toEqual(false);
        expect(writer.isClosed).toEqual(false);
        expect(writer.handle !== null).toEqual(true);
        expect(writer.encoding).toEqual(ReliableTxtEncoding.Utf8);
        writer.writeNode(new SmlAttribute("Attribute1"));
        writer.close();
        expect(writer.isClosed).toEqual(true);
        const loaded = ReliableTxtFile.loadSync(testFilePath);
        expect(loaded.text).toEqual("Root\n\tAttribute1 -\nEnd");
        expect(loaded.encoding).toEqual(ReliableTxtEncoding.Utf8);
        const template2 = new SmlDocument(new SmlElement("Root2"));
        const writer2 = SyncSmlStreamWriter.create(template2, testFilePath);
        expect(writer2.existing).toEqual(false);
        writer2.writeNode(new SmlAttribute("Attribute1"));
        writer2.close();
        const loaded2 = ReliableTxtFile.loadSync(testFilePath);
        expect(loaded2.text).toEqual("Root2\n\tAttribute1 -\nEnd");
        expect(loaded2.encoding).toEqual(ReliableTxtEncoding.Utf8);
        const writer3 = SyncSmlStreamWriter.create(template2, testFilePath, WriterMode.CreateOrAppend, true);
        expect(writer3.existing).toEqual(true);
        writer3.writeNode(new SmlAttribute("Attribute2"));
        writer3.close();
        const loaded3 = ReliableTxtFile.loadSync(testFilePath);
        expect(loaded3.text).toEqual("Root2\n\tAttribute1 -\n\tAttribute2 -\nEnd");
        expect(loaded3.encoding).toEqual(ReliableTxtEncoding.Utf8);
        deleteFileSync(testFilePath);
        const writer4 = SyncSmlStreamWriter.create(template, testFilePath, WriterMode.CreateOrAppend, true);
        expect(writer4.existing).toEqual(false);
        writer4.close();
        const loaded4 = ReliableTxtFile.loadSync(testFilePath);
        expect(loaded4.text).toEqual("Root\nEnd");
        expect(loaded4.encoding).toEqual(ReliableTxtEncoding.Utf8);
    });
    test("Invalid end keyword", () => {
        ReliableTxtFile.writeAllTextSync("Root\nEnd End", testFilePath, ReliableTxtEncoding.Utf8);
        const template = new SmlDocument(new SmlElement("Root"));
        expect(() => SyncSmlStreamWriter.create(template, testFilePath, WriterMode.CreateOrAppend, true)).toThrowError();
    });
});
test("SyncSmlStreamWriter append reader", () => {
    ReliableTxtFile.writeAllTextSync("Root\n\tAttribute 1\nEnd", testFilePath);
    const template = new SmlDocument(new SmlElement("Root"));
    let writer = SyncSmlStreamWriter.create(template, testFilePath, WriterMode.CreateOrAppend);
    expect(writer.existing).toEqual(true);
    const reader = SyncSmlStreamReader.getAppendReader(writer);
    const node1 = reader.readNode();
    expect(node1 === null || node1 === void 0 ? void 0 : node1.isAttribute()).toEqual(true);
    expect(reader.readNode()).toEqual(null);
    writer.close();
    writer = SyncSmlStreamWriter.create(template, testFilePath);
    expect(() => SyncSmlStreamReader.getAppendReader(writer)).toThrowError();
    writer.close();
});
// ----------------------------------------------------------------------
describe("SmlStreamWriter Constructor", () => {
    test("Test", async () => {
        await deleteFile(testFilePath);
        const template = new SmlDocument(new SmlElement("Root"));
        const writer = await SmlStreamWriter.create(template, testFilePath);
        expect(writer.existing).toEqual(false);
        expect(writer.isClosed).toEqual(false);
        expect(writer.handle !== null).toEqual(true);
        expect(writer.encoding).toEqual(ReliableTxtEncoding.Utf8);
        await writer.writeNode(new SmlAttribute("Attribute1"));
        await writer.close();
        expect(writer.isClosed).toEqual(true);
        const loaded = await ReliableTxtFile.load(testFilePath);
        expect(loaded.text).toEqual("Root\n\tAttribute1 -\nEnd");
        expect(loaded.encoding).toEqual(ReliableTxtEncoding.Utf8);
        const template2 = new SmlDocument(new SmlElement("Root2"));
        const writer2 = await SmlStreamWriter.create(template2, testFilePath);
        expect(writer2.existing).toEqual(false);
        await writer2.writeNode(new SmlAttribute("Attribute1"));
        await writer2.close();
        const loaded2 = await ReliableTxtFile.load(testFilePath);
        expect(loaded2.text).toEqual("Root2\n\tAttribute1 -\nEnd");
        expect(loaded2.encoding).toEqual(ReliableTxtEncoding.Utf8);
        const writer3 = await SmlStreamWriter.create(template2, testFilePath, WriterMode.CreateOrAppend, true);
        expect(writer3.existing).toEqual(true);
        await writer3.writeNode(new SmlAttribute("Attribute2"));
        await writer3.close();
        const loaded3 = await ReliableTxtFile.load(testFilePath);
        expect(loaded3.text).toEqual("Root2\n\tAttribute1 -\n\tAttribute2 -\nEnd");
        expect(loaded3.encoding).toEqual(ReliableTxtEncoding.Utf8);
        await deleteFile(testFilePath);
        const writer4 = await SmlStreamWriter.create(template, testFilePath, WriterMode.CreateOrAppend, true);
        expect(writer4.existing).toEqual(false);
        await writer4.close();
        const loaded4 = await ReliableTxtFile.load(testFilePath);
        expect(loaded4.text).toEqual("Root\nEnd");
        expect(loaded4.encoding).toEqual(ReliableTxtEncoding.Utf8);
    });
    test("Invalid end keyword", async () => {
        await ReliableTxtFile.writeAllText("Root\nEnd End", testFilePath, ReliableTxtEncoding.Utf8);
        const template = new SmlDocument(new SmlElement("Root"));
        await expect(async () => await SmlStreamWriter.create(template, testFilePath, WriterMode.CreateOrAppend, true)).rejects.toThrowError();
    });
});
test("SmlStreamWriter append reader", async () => {
    await ReliableTxtFile.writeAllText("Root\n\tAttribute 1\nEnd", testFilePath);
    const template = new SmlDocument(new SmlElement("Root"));
    let writer = await SmlStreamWriter.create(template, testFilePath, WriterMode.CreateOrAppend);
    expect(writer.existing).toEqual(true);
    const reader = await SmlStreamReader.getAppendReader(writer);
    const node1 = await reader.readNode();
    expect(node1 === null || node1 === void 0 ? void 0 : node1.isAttribute()).toEqual(true);
    expect(await reader.readNode()).toEqual(null);
    await writer.close();
    writer = await SmlStreamWriter.create(template, testFilePath);
    await expect(async () => await SmlStreamReader.getAppendReader(writer)).rejects.toThrowError();
    await writer.close();
});
//# sourceMappingURL=sml-io.test.js.map