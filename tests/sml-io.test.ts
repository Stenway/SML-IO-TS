﻿import { NoReliableTxtPreambleError } from '@stenway/reliabletxt'
import { ReliableTxtEncoding } from '@stenway/reliabletxt'
import { ReliableTxtFile } from '@stenway/reliabletxt-io'
import { SmlAttribute, SmlDocument, SmlElement, SmlEmptyNode } from '@stenway/sml'
import { SyncWsvStreamReader } from '@stenway/wsv-io'
import * as fs from 'fs'
import { SmlFile, SmlStreamWriter, SyncSmlStreamReader, SyncSmlStreamWriter, SyncWsvStreamLineIterator } from '../src'

function getFilePath(name: string): string {
	return "test_files/"+name
}

const testFilePath: string = getFilePath("Test.sml")

function writeBytesSync(bytes: Uint8Array, filePath: string) {
	fs.writeFileSync(filePath, bytes)
}

async function writeBytes(bytes: Uint8Array, filePath: string) {
	await fs.promises.writeFile(filePath, bytes)
}

function deleteFileSync(filePath: string): boolean {
	try {
		fs.unlinkSync(filePath)
	} catch {
		return false
	}
	return true
}

async function deleteFile(filePath: string): Promise<boolean> {
	try {
		await fs.promises.unlink(filePath)
	} catch {
		return false
	}
	return true
}

// ----------------------------------------------------------------------

describe("SmlFile.saveSync + loadSync", () => {
	test.each([
		[ReliableTxtEncoding.Utf8],
		[ReliableTxtEncoding.Utf16],
		[ReliableTxtEncoding.Utf16Reverse],
		[ReliableTxtEncoding.Utf32],
	])(
		"Given %p",
		(encoding) => {
			const document = SmlDocument.parse(" Root  \n Attribute 1 2  # c\n #c\n End")
			document.encoding = encoding
			SmlFile.saveSync(document, testFilePath)
			let loadedDocument = SmlFile.loadSync(testFilePath)
			expect(loadedDocument.toString()).toEqual(document.toString())
			expect(loadedDocument.encoding).toEqual(document.encoding)

			loadedDocument = SmlFile.loadSync(testFilePath, false)
			expect(loadedDocument.toString()).toEqual("Root\n\tAttribute 1 2\nEnd")
			expect(loadedDocument.encoding).toEqual(document.encoding)

			SmlFile.saveSync(document, testFilePath, false)
			loadedDocument = SmlFile.loadSync(testFilePath, true)
			expect(loadedDocument.toString()).toEqual("Root\n\tAttribute 1 2\nEnd")
			expect(loadedDocument.encoding).toEqual(document.encoding)
		}
	)

	test("Throws", () => {
		writeBytesSync(new Uint8Array([]), testFilePath)
		expect(() => SmlFile.loadSync(testFilePath)).toThrowError(NoReliableTxtPreambleError)
	})
})

describe("SmlFile.save + load", () => {
	test.each([
		[ReliableTxtEncoding.Utf8],
		[ReliableTxtEncoding.Utf16],
		[ReliableTxtEncoding.Utf16Reverse],
		[ReliableTxtEncoding.Utf32],
	])(
		"Given %p",
		async (encoding) => {
			const document = SmlDocument.parse(" Root  \n Attribute 1 2  # c\n #c\n End")
			document.encoding = encoding
			await SmlFile.save(document, testFilePath)
			let loadedDocument = await SmlFile.load(testFilePath)
			expect(loadedDocument.toString()).toEqual(document.toString())
			expect(loadedDocument.encoding).toEqual(document.encoding)

			loadedDocument = await SmlFile.load(testFilePath, false)
			expect(loadedDocument.toString()).toEqual("Root\n\tAttribute 1 2\nEnd")
			expect(loadedDocument.encoding).toEqual(document.encoding)

			await SmlFile.save(document, testFilePath, false)
			loadedDocument = await SmlFile.load(testFilePath, true)
			expect(loadedDocument.toString()).toEqual("Root\n\tAttribute 1 2\nEnd")
			expect(loadedDocument.encoding).toEqual(document.encoding)
		}
	)

	test("Throws", async () => {
		await writeBytes(new Uint8Array([]), testFilePath)
		await expect(async () => await SmlFile.load(testFilePath)).rejects.toThrowError(NoReliableTxtPreambleError)
	})
})

describe("SmlFile.appendNodesSync", () => {
	test("Utf8", () => {
		ReliableTxtFile.writeAllTextSync("Root\nEnd", testFilePath)
		const template = new SmlDocument(new SmlElement("Root"))
		SmlFile.appendNodesSync([new SmlAttribute("Attribute1"), new SmlAttribute("Attribute2")], template, testFilePath)
		SmlFile.appendNodesSync([], template, testFilePath)

		expect(ReliableTxtFile.readAllTextSync(testFilePath)).toEqual("Root\n\tAttribute1 -\n\tAttribute2 -\nEnd")
	})

	test("Throws", () => {
		writeBytesSync(new Uint8Array([]), testFilePath)
		const template = new SmlDocument(new SmlElement("Root"))
		expect(() => SmlFile.appendNodesSync([new SmlAttribute("Attribute1")], template, testFilePath)).toThrowError(NoReliableTxtPreambleError)
	})
})

describe("SmlFile.appendNodes", () => {
	test("Utf8", async () => {
		await ReliableTxtFile.writeAllText("Root\nEnd", testFilePath)
		const template = new SmlDocument(new SmlElement("Root"))
		await SmlFile.appendNodes([new SmlAttribute("Attribute1"), new SmlAttribute("Attribute2")], template, testFilePath)
		await SmlFile.appendNodes([], template, testFilePath)

		expect(await ReliableTxtFile.readAllText(testFilePath)).toEqual("Root\n\tAttribute1 -\n\tAttribute2 -\nEnd")
	})

	test("Throws", async () => {
		await writeBytes(new Uint8Array([]), testFilePath)
		const template = new SmlDocument(new SmlElement("Root"))
		await expect(async () => await SmlFile.appendNodes([new SmlAttribute("Attribute1")], template, testFilePath)).rejects.toThrowError(NoReliableTxtPreambleError)
	})
})

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
	])(
		"Given %p",
		(input, output) => {
			ReliableTxtFile.writeAllTextSync(input, testFilePath, ReliableTxtEncoding.Utf8)
			const reader = new SyncSmlStreamReader(testFilePath)
			expect(reader.encoding).toEqual(ReliableTxtEncoding.Utf8)
			expect(reader.endKeyword).toEqual(output)
			expect(reader.handle !== null).toEqual(true)
			reader.close()
		}
	)

	test.each([
		[ReliableTxtEncoding.Utf16],
		[ReliableTxtEncoding.Utf16Reverse],
		[ReliableTxtEncoding.Utf32],
	])(
		"Given %p throws",
		(encoding) => {
			ReliableTxtFile.writeAllTextSync("Root\nEnd", testFilePath, encoding)
			expect(() => new SyncSmlStreamReader(testFilePath)).toThrowError()
		}
	)

	test("Invalid end keyword", () => {
		ReliableTxtFile.writeAllTextSync("Root\nEnd End", testFilePath, ReliableTxtEncoding.Utf8)
		expect(() => new SyncSmlStreamReader(testFilePath)).toThrowError()
	})

	test("Chunk size", () => {
		ReliableTxtFile.writeAllTextSync("Root\nEnd", testFilePath, ReliableTxtEncoding.Utf8)
		expect(() => new SyncSmlStreamReader(testFilePath, true, 1)).toThrowError("Chunk size too small")
	})
})

test("SyncSmlStreamReader.isClosed", () => {
	ReliableTxtFile.writeAllTextSync("Root\nEnd", testFilePath, ReliableTxtEncoding.Utf8)
	const writer = new SyncSmlStreamReader(testFilePath)
	expect(writer.isClosed).toEqual(false)
	writer.close()
	expect(writer.isClosed).toEqual(true)
})

describe("SyncSmlStreamReader.readLine", () => {
	test("Null", () => {
		ReliableTxtFile.writeAllTextSync("Root\n\tAttribute1 10\n\tSub\n\tEnd\n\t#comment\nEnd", testFilePath)
		const reader = new SyncSmlStreamReader(testFilePath)
		const line1 = reader.readNode() as SmlAttribute
		if (line1 === null) { throw Error() }
		expect(line1.toString()).toEqual("\tAttribute1 10")
		const line2 = reader.readNode() as SmlElement
		if (line2 === null) { throw Error() }
		expect(line2.toString()).toEqual("\tSub\n\tEnd")
		const line3 = reader.readNode() as SmlEmptyNode
		if (line3 === null) { throw Error() }
		expect(line3.toString()).toEqual("\t#comment")
		expect(reader.readNode()).toEqual(null)
		reader.close()
	})

	test("Not preserving", () => {
		ReliableTxtFile.writeAllTextSync("Root\n\tAttribute1 10\n\tSub\n\tEnd\n\t#comment\nEnd", testFilePath)
		const reader = new SyncSmlStreamReader(testFilePath, false)
		const line1 = reader.readNode() as SmlAttribute
		if (line1 === null) { throw Error() }
		expect(line1.toString()).toEqual("Attribute1 10")
		const line2 = reader.readNode() as SmlElement
		if (line2 === null) { throw Error() }
		expect(line2.toString()).toEqual("Sub\nEnd")
		expect(reader.readNode()).toEqual(null)
		reader.close()
	})

	test("Closed", () => {
		ReliableTxtFile.writeAllTextSync("Root\nEnd", testFilePath)
		const reader = new SyncSmlStreamReader(testFilePath)
		reader.close()
		expect(() => reader.readNode()).toThrowError()
	})
})

// ----------------------------------------------------------------------

test("SyncWsvStreamLineIterator", () => {
	ReliableTxtFile.writeAllTextSync("Root\nEnd", testFilePath)
	const reader = new SyncWsvStreamReader(testFilePath)
	const iterator = new SyncWsvStreamLineIterator(reader, "End")
	expect(iterator.getLineAsArray()).toEqual(["Root"])
	expect(iterator.toString()).toEqual("(2): End")
	expect(iterator.getLineIndex()).toEqual(1)
	expect(iterator.getLine().toString()).toEqual("End")
	expect(iterator.hasLine()).toEqual(false)
	expect(() => iterator.getLine()).toThrowError()
	expect(() => iterator.isEmptyLine()).toThrowError()
	reader.close()
})

// ----------------------------------------------------------------------

describe("SyncSmlStreamWriter Constructor", () => {
	test("Test", () => {
		deleteFileSync(testFilePath)
		const template = new SmlDocument(new SmlElement("Root"))
		const writer = new SyncSmlStreamWriter(template, testFilePath)
		expect(writer.isAppendMode).toEqual(false)
		expect(writer.isClosed).toEqual(false)
		expect(writer.handle !== null).toEqual(true)
		expect(writer.encoding).toEqual(ReliableTxtEncoding.Utf8)
		writer.writeNode(new SmlAttribute("Attribute1"))
		writer.close()
		expect(writer.isClosed).toEqual(true)
		expect(writer.handle === null).toEqual(true)
		const loaded = ReliableTxtFile.loadSync(testFilePath)
		expect(loaded.text).toEqual("Root\n\tAttribute1 -\nEnd")
		expect(loaded.encoding).toEqual(ReliableTxtEncoding.Utf8)

		const template2 = new SmlDocument(new SmlElement("Root2"))
		const writer2 = new SyncSmlStreamWriter(template2, testFilePath)
		expect(writer2.isAppendMode).toEqual(false)
		writer2.writeNode(new SmlAttribute("Attribute1"))
		writer2.close()
		const loaded2 = ReliableTxtFile.loadSync(testFilePath)
		expect(loaded2.text).toEqual("Root2\n\tAttribute1 -\nEnd")
		expect(loaded2.encoding).toEqual(ReliableTxtEncoding.Utf8)

		const writer3 = new SyncSmlStreamWriter(template2, testFilePath, true, true)
		expect(writer3.isAppendMode).toEqual(true)
		writer3.writeNode(new SmlAttribute("Attribute2"))
		writer3.close()
		const loaded3 = ReliableTxtFile.loadSync(testFilePath)
		expect(loaded3.text).toEqual("Root2\n\tAttribute1 -\n\tAttribute2 -\nEnd")
		expect(loaded3.encoding).toEqual(ReliableTxtEncoding.Utf8)

		deleteFileSync(testFilePath)
		const writer4 = new SyncSmlStreamWriter(template, testFilePath, true, true)
		expect(writer4.isAppendMode).toEqual(false)
		writer4.close()
		const loaded4 = ReliableTxtFile.loadSync(testFilePath)
		expect(loaded4.text).toEqual("Root\nEnd")
		expect(loaded4.encoding).toEqual(ReliableTxtEncoding.Utf8)
	})

	test("Invalid end keyword", () => {
		ReliableTxtFile.writeAllTextSync("Root\nEnd End", testFilePath, ReliableTxtEncoding.Utf8)
		const template = new SmlDocument(new SmlElement("Root"))
		expect(() => new SyncSmlStreamWriter(template, testFilePath, true, true)).toThrowError()
	})
})

// ----------------------------------------------------------------------

describe("SmlStreamWriter Constructor", () => {
	test("Test", async () => {
		await deleteFile(testFilePath)
		const template = new SmlDocument(new SmlElement("Root"))
		const writer = await SmlStreamWriter.create(template, testFilePath)
		expect(writer.isAppendMode).toEqual(false)
		expect(writer.isClosed).toEqual(false)
		expect(writer.handle !== null).toEqual(true)
		expect(writer.encoding).toEqual(ReliableTxtEncoding.Utf8)
		await writer.writeNode(new SmlAttribute("Attribute1"))
		await writer.close()
		expect(writer.isClosed).toEqual(true)
		expect(writer.handle === null).toEqual(true)
		const loaded = await ReliableTxtFile.load(testFilePath)
		expect(loaded.text).toEqual("Root\n\tAttribute1 -\nEnd")
		expect(loaded.encoding).toEqual(ReliableTxtEncoding.Utf8)

		const template2 = new SmlDocument(new SmlElement("Root2"))
		const writer2 = await SmlStreamWriter.create(template2, testFilePath)
		expect(writer2.isAppendMode).toEqual(false)
		await writer2.writeNode(new SmlAttribute("Attribute1"))
		await writer2.close()
		const loaded2 = await ReliableTxtFile.load(testFilePath)
		expect(loaded2.text).toEqual("Root2\n\tAttribute1 -\nEnd")
		expect(loaded2.encoding).toEqual(ReliableTxtEncoding.Utf8)

		const writer3 = await SmlStreamWriter.create(template2, testFilePath, true, true)
		expect(writer3.isAppendMode).toEqual(true)
		await writer3.writeNode(new SmlAttribute("Attribute2"))
		await writer3.close()
		const loaded3 = await ReliableTxtFile.load(testFilePath)
		expect(loaded3.text).toEqual("Root2\n\tAttribute1 -\n\tAttribute2 -\nEnd")
		expect(loaded3.encoding).toEqual(ReliableTxtEncoding.Utf8)

		await deleteFile(testFilePath)
		const writer4 = await SmlStreamWriter.create(template, testFilePath, true, true)
		expect(writer4.isAppendMode).toEqual(false)
		await writer4.close()
		const loaded4 = await ReliableTxtFile.load(testFilePath)
		expect(loaded4.text).toEqual("Root\nEnd")
		expect(loaded4.encoding).toEqual(ReliableTxtEncoding.Utf8)
	})

	test("Invalid end keyword", async () => {
		await ReliableTxtFile.writeAllText("Root\nEnd End", testFilePath, ReliableTxtEncoding.Utf8)
		const template = new SmlDocument(new SmlElement("Root"))
		await expect(async () => await SmlStreamWriter.create(template, testFilePath, true, true)).rejects.toThrowError()
	})
})