﻿import { NoReliableTxtPreambleError } from '@stenway/reliabletxt'
import { ReliableTxtEncoding } from '@stenway/reliabletxt'
import { ReliableTxtFile, WriterMode } from '@stenway/reliabletxt-io'
import { SmlAttribute, SmlDocument, SmlElement, SmlEmptyNode } from '@stenway/sml'
import { SyncWsvStreamReader, WsvStreamReader } from '@stenway/wsv-io'
import * as fs from 'node:fs'
import { BinarySmlFile, BinarySmlFileHandle, BinarySmlStreamReader, BinarySmlStreamWriter, SmlFile, SmlStreamReader, SmlStreamWriter, SyncBinarySmlFileHandle, SyncBinarySmlStreamReader, SyncBinarySmlStreamWriter, SyncSmlStreamReader, SyncSmlStreamWriter, SyncWsvStreamLineIterator, WsvStreamLineIterator } from '../src/sml-io.js'

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
			const reader = SyncSmlStreamReader.create(testFilePath)
			expect(reader.encoding).toEqual(ReliableTxtEncoding.Utf8)
			expect(reader.endKeyword).toEqual(output)
			expect(reader.handle.encoding).toEqual(ReliableTxtEncoding.Utf8)
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
			expect(() => SyncSmlStreamReader.create(testFilePath)).toThrowError()
		}
	)

	test("Invalid end keyword", () => {
		ReliableTxtFile.writeAllTextSync("Root\nEnd End", testFilePath, ReliableTxtEncoding.Utf8)
		expect(() => SyncSmlStreamReader.create(testFilePath)).toThrowError()
	})

	test("Chunk size", () => {
		ReliableTxtFile.writeAllTextSync("Root\nEnd", testFilePath, ReliableTxtEncoding.Utf8)
		expect(() => SyncSmlStreamReader.create(testFilePath, true, 1)).toThrowError("Chunk size too small")
	})
})

test("SyncSmlStreamReader.isClosed", () => {
	ReliableTxtFile.writeAllTextSync("Root\nEnd", testFilePath, ReliableTxtEncoding.Utf8)
	const writer = SyncSmlStreamReader.create(testFilePath)
	expect(writer.isClosed).toEqual(false)
	writer.close()
	expect(writer.isClosed).toEqual(true)
})

describe("SyncSmlStreamReader.readLine", () => {
	test("Null", () => {
		ReliableTxtFile.writeAllTextSync("Root\n\tAttribute1 10\n\tSub\n\tEnd\n\t#comment\nEnd", testFilePath)
		const reader = SyncSmlStreamReader.create(testFilePath)
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
		expect(reader.readNode()).toEqual(null)
		reader.close()
	})

	test("Not preserving", () => {
		ReliableTxtFile.writeAllTextSync("Root\n\tAttribute1 10\n\tSub\n\tEnd\n\t#comment\nEnd", testFilePath)
		const reader = SyncSmlStreamReader.create(testFilePath, false)
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
		const reader = SyncSmlStreamReader.create(testFilePath)
		reader.close()
		expect(() => reader.readNode()).toThrowError()
	})
})

// ----------------------------------------------------------------------

test("SyncWsvStreamLineIterator", () => {
	ReliableTxtFile.writeAllTextSync("Root\nEnd", testFilePath)
	const reader = SyncWsvStreamReader.create(testFilePath)
	const iterator = SyncWsvStreamLineIterator.create(reader, "End")
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

describe("SmlStreamReader Constructor", () => {
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
		async (input, output) => {
			await ReliableTxtFile.writeAllText(input, testFilePath, ReliableTxtEncoding.Utf8)
			const reader = await SmlStreamReader.create(testFilePath)
			expect(reader.encoding).toEqual(ReliableTxtEncoding.Utf8)
			expect(reader.endKeyword).toEqual(output)
			expect(reader.handle.encoding).toEqual(ReliableTxtEncoding.Utf8)
			await reader.close()
		}
	)

	test.each([
		[ReliableTxtEncoding.Utf16],
		[ReliableTxtEncoding.Utf16Reverse],
		[ReliableTxtEncoding.Utf32],
	])(
		"Given %p throws",
		async (encoding) => {
			await ReliableTxtFile.writeAllText("Root\nEnd", testFilePath, encoding)
			await expect(async () => await SmlStreamReader.create(testFilePath)).rejects.toThrowError()
		}
	)

	test("Invalid end keyword", async () => {
		await ReliableTxtFile.writeAllText("Root\nEnd End", testFilePath, ReliableTxtEncoding.Utf8)
		await expect(async () => await SmlStreamReader.create(testFilePath)).rejects.toThrowError()
	})

	test("Chunk size", async () => {
		await ReliableTxtFile.writeAllText("Root\nEnd", testFilePath, ReliableTxtEncoding.Utf8)
		await expect(async () => await SmlStreamReader.create(testFilePath, true, 1)).rejects.toThrowError("Chunk size too small")
	})
})

test("SmlStreamReader.isClosed", async () => {
	await ReliableTxtFile.writeAllText("Root\nEnd", testFilePath, ReliableTxtEncoding.Utf8)
	const writer = await SmlStreamReader.create(testFilePath)
	expect(writer.isClosed).toEqual(false)
	await writer.close()
	expect(writer.isClosed).toEqual(true)
})

describe("SmlStreamReader.readLine", () => {
	test("Null", async () => {
		await ReliableTxtFile.writeAllText("Root\n\tAttribute1 10\n\tSub\n\tEnd\n\t#comment\nEnd", testFilePath)
		const reader = await SmlStreamReader.create(testFilePath)
		const line1 = await reader.readNode() as SmlAttribute
		if (line1 === null) { throw Error() }
		expect(line1.toString()).toEqual("\tAttribute1 10")
		const line2 = await reader.readNode() as SmlElement
		if (line2 === null) { throw Error() }
		expect(line2.toString()).toEqual("\tSub\n\tEnd")
		const line3 = await reader.readNode() as SmlEmptyNode
		if (line3 === null) { throw Error() }
		expect(line3.toString()).toEqual("\t#comment")
		expect(await reader.readNode()).toEqual(null)
		expect(await reader.readNode()).toEqual(null)
		await reader.close()
	})

	test("Not preserving", async () => {
		await ReliableTxtFile.writeAllText("Root\n\tAttribute1 10\n\tSub\n\tEnd\n\t#comment\nEnd", testFilePath)
		const reader = await SmlStreamReader.create(testFilePath, false)
		const line1 = await reader.readNode() as SmlAttribute
		if (line1 === null) { throw Error() }
		expect(line1.toString()).toEqual("Attribute1 10")
		const line2 = await reader.readNode() as SmlElement
		if (line2 === null) { throw Error() }
		expect(line2.toString()).toEqual("Sub\nEnd")
		expect(await reader.readNode()).toEqual(null)
		await reader.close()
	})

	test("Closed", async () => {
		await ReliableTxtFile.writeAllText("Root\nEnd", testFilePath)
		const reader = await SmlStreamReader.create(testFilePath)
		await reader.close()
		await expect(async () => await reader.readNode()).rejects.toThrowError()
	})
})

// ----------------------------------------------------------------------

test("WsvStreamLineIterator", async () => {
	await ReliableTxtFile.writeAllText("Root\nEnd", testFilePath)
	const reader = await WsvStreamReader.create(testFilePath)
	const iterator = await WsvStreamLineIterator.create(reader, "End")
	expect(await iterator.getLineAsArray()).toEqual(["Root"])
	expect(iterator.toString()).toEqual("(2): End")
	expect(iterator.getLineIndex()).toEqual(1)
	expect((await iterator.getLine()).toString()).toEqual("End")
	expect(await iterator.hasLine()).toEqual(false)
	await expect(async () => await iterator.getLine()).rejects.toThrowError()
	await expect(async () => await iterator.isEmptyLine()).rejects.toThrowError()
	await reader.close()
})

// ----------------------------------------------------------------------

describe("SyncSmlStreamWriter Constructor", () => {
	test("Test", () => {
		deleteFileSync(testFilePath)
		const template = new SmlDocument(new SmlElement("Root"))
		const writer = SyncSmlStreamWriter.create(template, testFilePath)
		expect(writer.existing).toEqual(false)
		expect(writer.isClosed).toEqual(false)
		expect(writer.handle !== null).toEqual(true)
		expect(writer.encoding).toEqual(ReliableTxtEncoding.Utf8)
		writer.writeNode(new SmlAttribute("Attribute1"))
		writer.close()
		expect(writer.isClosed).toEqual(true)
		const loaded = ReliableTxtFile.loadSync(testFilePath)
		expect(loaded.text).toEqual("Root\n\tAttribute1 -\nEnd")
		expect(loaded.encoding).toEqual(ReliableTxtEncoding.Utf8)

		const template2 = new SmlDocument(new SmlElement("Root2"))
		const writer2 = SyncSmlStreamWriter.create(template2, testFilePath)
		expect(writer2.existing).toEqual(false)
		writer2.writeNode(new SmlAttribute("Attribute1"))
		writer2.close()
		const loaded2 = ReliableTxtFile.loadSync(testFilePath)
		expect(loaded2.text).toEqual("Root2\n\tAttribute1 -\nEnd")
		expect(loaded2.encoding).toEqual(ReliableTxtEncoding.Utf8)

		const writer3 = SyncSmlStreamWriter.create(template2, testFilePath, WriterMode.CreateOrAppend, true)
		expect(writer3.existing).toEqual(true)
		writer3.writeNode(new SmlAttribute("Attribute2"))
		writer3.close()
		const loaded3 = ReliableTxtFile.loadSync(testFilePath)
		expect(loaded3.text).toEqual("Root2\n\tAttribute1 -\n\tAttribute2 -\nEnd")
		expect(loaded3.encoding).toEqual(ReliableTxtEncoding.Utf8)

		deleteFileSync(testFilePath)
		const writer4 = SyncSmlStreamWriter.create(template, testFilePath, WriterMode.CreateOrAppend, true)
		expect(writer4.existing).toEqual(false)
		writer4.close()
		const loaded4 = ReliableTxtFile.loadSync(testFilePath)
		expect(loaded4.text).toEqual("Root\nEnd")
		expect(loaded4.encoding).toEqual(ReliableTxtEncoding.Utf8)
	})

	test("Invalid end keyword", () => {
		ReliableTxtFile.writeAllTextSync("Root\nEnd End", testFilePath, ReliableTxtEncoding.Utf8)
		const template = new SmlDocument(new SmlElement("Root"))
		expect(() => SyncSmlStreamWriter.create(template, testFilePath, WriterMode.CreateOrAppend, true)).toThrowError()
	})
})

test("SyncSmlStreamWriter append reader", () => {
	ReliableTxtFile.writeAllTextSync("Root\n\tAttribute 1\nEnd", testFilePath)
	const template = new SmlDocument(new SmlElement("Root"))
	let writer = SyncSmlStreamWriter.create(template, testFilePath, WriterMode.CreateOrAppend)
	expect(writer.existing).toEqual(true)
	const reader = SyncSmlStreamReader.getAppendReader(writer)
	const node1 = reader.readNode()
	expect(node1?.isAttribute()).toEqual(true)
	expect(reader.readNode()).toEqual(null)
	writer.close()

	writer = SyncSmlStreamWriter.create(template, testFilePath)
	expect(() => SyncSmlStreamReader.getAppendReader(writer)).toThrowError()
	writer.close()
})

// ----------------------------------------------------------------------

describe("SmlStreamWriter Constructor", () => {
	test("Test", async () => {
		await deleteFile(testFilePath)
		const template = new SmlDocument(new SmlElement("Root"))
		const writer = await SmlStreamWriter.create(template, testFilePath)
		expect(writer.existing).toEqual(false)
		expect(writer.isClosed).toEqual(false)
		expect(writer.handle !== null).toEqual(true)
		expect(writer.encoding).toEqual(ReliableTxtEncoding.Utf8)
		await writer.writeNode(new SmlAttribute("Attribute1"))
		await writer.close()
		expect(writer.isClosed).toEqual(true)
		const loaded = await ReliableTxtFile.load(testFilePath)
		expect(loaded.text).toEqual("Root\n\tAttribute1 -\nEnd")
		expect(loaded.encoding).toEqual(ReliableTxtEncoding.Utf8)

		const template2 = new SmlDocument(new SmlElement("Root2"))
		const writer2 = await SmlStreamWriter.create(template2, testFilePath)
		expect(writer2.existing).toEqual(false)
		await writer2.writeNode(new SmlAttribute("Attribute1"))
		await writer2.close()
		const loaded2 = await ReliableTxtFile.load(testFilePath)
		expect(loaded2.text).toEqual("Root2\n\tAttribute1 -\nEnd")
		expect(loaded2.encoding).toEqual(ReliableTxtEncoding.Utf8)

		const writer3 = await SmlStreamWriter.create(template2, testFilePath, WriterMode.CreateOrAppend, true)
		expect(writer3.existing).toEqual(true)
		await writer3.writeNode(new SmlAttribute("Attribute2"))
		await writer3.close()
		const loaded3 = await ReliableTxtFile.load(testFilePath)
		expect(loaded3.text).toEqual("Root2\n\tAttribute1 -\n\tAttribute2 -\nEnd")
		expect(loaded3.encoding).toEqual(ReliableTxtEncoding.Utf8)

		await deleteFile(testFilePath)
		const writer4 = await SmlStreamWriter.create(template, testFilePath, WriterMode.CreateOrAppend, true)
		expect(writer4.existing).toEqual(false)
		await writer4.close()
		const loaded4 = await ReliableTxtFile.load(testFilePath)
		expect(loaded4.text).toEqual("Root\nEnd")
		expect(loaded4.encoding).toEqual(ReliableTxtEncoding.Utf8)
	})

	test("Invalid end keyword", async () => {
		await ReliableTxtFile.writeAllText("Root\nEnd End", testFilePath, ReliableTxtEncoding.Utf8)
		const template = new SmlDocument(new SmlElement("Root"))
		await expect(async () => await SmlStreamWriter.create(template, testFilePath, WriterMode.CreateOrAppend, true)).rejects.toThrowError()
	})
})

test("SmlStreamWriter append reader", async () => {
	await ReliableTxtFile.writeAllText("Root\n\tAttribute 1\nEnd", testFilePath)
	const template = new SmlDocument(new SmlElement("Root"))
	let writer = await SmlStreamWriter.create(template, testFilePath, WriterMode.CreateOrAppend)
	expect(writer.existing).toEqual(true)
	const reader = await SmlStreamReader.getAppendReader(writer)
	const node1 = await reader.readNode()
	expect(node1?.isAttribute()).toEqual(true)
	expect(await reader.readNode()).toEqual(null)
	await writer.close()

	writer = await SmlStreamWriter.create(template, testFilePath)
	await expect(async () => await SmlStreamReader.getAppendReader(writer)).rejects.toThrowError()
	await writer.close()
})

// ----------------------------------------------------------------------

const elementStartByte = 0b11111111
const elementEndByte = 0b11111110

const aByte = 0x41
const eByte = 0x45

// ----------------------------------------------------------------------

test("BinarySmlFile.saveSync + loadSync", () => {
	const document = SmlDocument.parse("A\nEnd")
	BinarySmlFile.saveSync(document, testFilePath)
	const loadedDocument = BinarySmlFile.loadSync(testFilePath)
	expect(document.toString()).toEqual(loadedDocument.toString())

	expect(() => BinarySmlFile.saveSync(document, testFilePath, false)).toThrowError()
})

test("BinarySmlFile.save + load", async () => {
	const document = SmlDocument.parse("A\nEnd")
	await BinarySmlFile.save(document, testFilePath)
	const loadedDocument = await BinarySmlFile.load(testFilePath)
	expect(document.toString()).toEqual(loadedDocument.toString())

	await expect(async () => await BinarySmlFile.save(document, testFilePath, false)).rejects.toThrowError()
})

test("BinarySmlFile.appendNodesSync", () => {
	deleteFileSync(testFilePath)
	const templateRootName = "Root"
	BinarySmlFile.appendNodesSync([new SmlAttribute("Attribute1")], templateRootName, testFilePath)
	BinarySmlFile.appendNodesSync([new SmlAttribute("Attribute2")], templateRootName, testFilePath)
	BinarySmlFile.appendNodesSync([], templateRootName, testFilePath)

	expect(BinarySmlFile.loadSync(testFilePath).toString()).toEqual("Root\n\tAttribute1 -\n\tAttribute2 -\nEnd")
})

test("BinarySmlFile.appendNodes", async () => {
	await deleteFile(testFilePath)
	const templateRootName = "Root"
	await BinarySmlFile.appendNodes([new SmlAttribute("Attribute1")], templateRootName, testFilePath)
	await BinarySmlFile.appendNodes([new SmlAttribute("Attribute2")], templateRootName, testFilePath)
	await BinarySmlFile.appendNodes([], templateRootName, testFilePath)

	expect((await BinarySmlFile.load(testFilePath)).toString()).toEqual("Root\n\tAttribute1 -\n\tAttribute2 -\nEnd")
})

// ----------------------------------------------------------------------

test("SyncBinarySmlStreamReader", () => {
	const document = SmlDocument.parse(`R\nA 1 "" -\nE\nEnd\nE\n"" 2\n""\nEnd\nEnd\nEnd`)
	BinarySmlFile.saveSync(document, testFilePath)

	const reader = SyncBinarySmlStreamReader.create(testFilePath)
	expect(reader.isClosed).toEqual(false)
	expect(reader.root.name).toEqual("R")
	
	const node1 = reader.readNode()
	expect(node1?.isAttribute()).toEqual(true)
	expect((node1 as SmlAttribute).toString()).toEqual(`A 1 "" -`)

	const node2 = reader.readNode()
	expect(node2?.isElement()).toEqual(true)
	expect((node2 as SmlElement).toString()).toEqual(`E\nEnd`)

	const node3 = reader.readNode()
	expect(node3?.isElement()).toEqual(true)
	expect((node3 as SmlElement).toString()).toEqual(`E\n\t"" 2\n\t""\n\tEnd\nEnd`)

	const node4 = reader.readNode()
	expect(node4).toEqual(null)
	expect(reader.readNode()).toEqual(null)

	reader.close()

	expect(reader.isClosed).toEqual(true)
})

describe("SyncBinarySmlStreamReader", () => {
	test("throws", () => {
		writeBytesSync(new Uint8Array([0x42, 0x53, 0x31]), testFilePath)
		expect(() => SyncBinarySmlStreamReader.create(testFilePath)).toThrowError()
		expect(() => SyncBinarySmlStreamReader.create(testFilePath, 30)).toThrowError()
	})

	test("throws", () => {
		writeBytesSync(new Uint8Array([0x42, 0x53, 0x31, aByte, elementStartByte]), testFilePath)
		const reader = SyncBinarySmlStreamReader.create(testFilePath)
		reader.close()
		expect(() => reader.readNode()).toThrowError()
	})

	test.each([
		[[eByte, elementStartByte, eByte, elementEndByte]],
	])(
		"Given %p throws",
		(input) => {
			writeBytesSync(new Uint8Array([0x42, 0x53, 0x31, ...input]), testFilePath)
			const reader = SyncBinarySmlStreamReader.create(testFilePath)
			expect(() => reader.readNode()).toThrowError()
			reader.close()
		}
	)

	test.each([
		[294],
		[588],
	])("Long value", (input) => {
		const longValue1 = "abcdefghijklmnopq".repeat(input)
		const longValue2 = "abcdefghijklmnopqr".repeat(input)
		const root = new SmlElement("E")
		root.addAttribute("A", [longValue1, longValue2, "c", "d"])
		const document = new SmlDocument(root)
		BinarySmlFile.saveSync(document, testFilePath)
		const reader = SyncBinarySmlStreamReader.create(testFilePath)
		const node = reader.readNode()
		expect((node as SmlAttribute).values).toEqual([longValue1, longValue2, "c", "d"])
		reader.close()
	})
})

// ----------------------------------------------------------------------

test("BinarySmlStreamReader", async () => {
	const document = SmlDocument.parse(`R\nA 1 "" -\nE\nEnd\nE\n"" 2\n""\nEnd\nEnd\nEnd`)
	await BinarySmlFile.save(document, testFilePath)

	const reader = await BinarySmlStreamReader.create(testFilePath)
	expect(reader.isClosed).toEqual(false)
	expect(reader.root.name).toEqual("R")
	
	const node1 = await reader.readNode()
	expect(node1?.isAttribute()).toEqual(true)
	expect((node1 as SmlAttribute).toString()).toEqual(`A 1 "" -`)

	const node2 = await reader.readNode()
	expect(node2?.isElement()).toEqual(true)
	expect((node2 as SmlElement).toString()).toEqual(`E\nEnd`)

	const node3 = await reader.readNode()
	expect(node3?.isElement()).toEqual(true)
	expect((node3 as SmlElement).toString()).toEqual(`E\n\t"" 2\n\t""\n\tEnd\nEnd`)

	const node4 = await reader.readNode()
	expect(node4).toEqual(null)
	expect(await reader.readNode()).toEqual(null)

	await reader.close()

	expect(reader.isClosed).toEqual(true)
})

describe("BinarySmlStreamReader", () => {
	test("throws", async () => {
		await writeBytes(new Uint8Array([0x42, 0x53, 0x31]), testFilePath)
		await expect(async () => await BinarySmlStreamReader.create(testFilePath)).rejects.toThrowError()
		await expect(async () => await BinarySmlStreamReader.create(testFilePath, 30)).rejects.toThrowError()
	})

	test("throws", async () => {
		await writeBytes(new Uint8Array([0x42, 0x53, 0x31, aByte, elementStartByte]), testFilePath)
		const reader = await BinarySmlStreamReader.create(testFilePath)
		await reader.close()
		await expect(async () => await reader.readNode()).rejects.toThrowError()
	})

	test.each([
		[[eByte, elementStartByte, eByte, elementEndByte]],
	])(
		"Given %p throws",
		async (input) => {
			await writeBytes(new Uint8Array([0x42, 0x53, 0x31, ...input]), testFilePath)
			const reader = await BinarySmlStreamReader.create(testFilePath)
			await expect(async () => await reader.readNode()).rejects.toThrowError()
			await reader.close()
		}
	)

	test.each([
		[294],
		[588],
	])("Long value", async (input) => {
		const longValue1 = "abcdefghijklmnopq".repeat(input)
		const longValue2 = "abcdefghijklmnopqr".repeat(input)
		const root = new SmlElement("E")
		root.addAttribute("A", [longValue1, longValue2, "c", "d"])
		const document = new SmlDocument(root)
		await BinarySmlFile.save(document, testFilePath)
		const reader = await BinarySmlStreamReader.create(testFilePath)
		const node = await reader.readNode()
		expect((node as SmlAttribute).values).toEqual([longValue1, longValue2, "c", "d"])
		await reader.close()
	})
})

// ----------------------------------------------------------------------

test("SyncBinarySmlStreamWriter", () => {
	deleteFileSync(testFilePath)
	const templateRootName = "Root"
	const writer = SyncBinarySmlStreamWriter.create(templateRootName, testFilePath)
	expect(writer.isClosed).toEqual(false)
	expect(writer.existing).toEqual(false)
	writer.writeNode(new SmlAttribute("Attribute1"))
	writer.close()
	expect(writer.isClosed).toEqual(true)

	expect(BinarySmlFile.loadSync(testFilePath).toString()).toEqual("Root\n\tAttribute1 -\nEnd")

	const appendWriter = SyncBinarySmlStreamWriter.create(templateRootName, testFilePath, WriterMode.CreateOrAppend)
	expect(appendWriter.existing).toEqual(true)
	appendWriter.close()

	expect(BinarySmlFile.loadSync(testFilePath).toString()).toEqual("Root\n\tAttribute1 -\nEnd")

	const appendWriter2 = SyncBinarySmlStreamWriter.create(templateRootName, testFilePath, WriterMode.CreateOrAppend)
	appendWriter2.writeNodes([new SmlAttribute("Attribute2")])
	appendWriter2.close()

	expect(BinarySmlFile.loadSync(testFilePath).toString()).toEqual("Root\n\tAttribute1 -\n\tAttribute2 -\nEnd")
})

test("SyncBinarySmlStreamWriter append reader", () => {
	const document = SmlDocument.parse("Root\n\tAttribute 1\nEnd")
	BinarySmlFile.saveSync(document, testFilePath)

	const templateRootName = "Root"
	let writer = SyncBinarySmlStreamWriter.create(templateRootName, testFilePath, WriterMode.CreateOrAppend)
	expect(writer.existing).toEqual(true)
	const reader = SyncBinarySmlStreamReader.getAppendReader(writer)
	const node1 = reader.readNode()
	expect(node1?.isAttribute()).toEqual(true)
	expect(reader.readNode()).toEqual(null)
	writer.close()

	writer = SyncBinarySmlStreamWriter.create(templateRootName, testFilePath)
	expect(() => SyncBinarySmlStreamReader.getAppendReader(writer)).toThrowError()
	writer.close()
})

// ----------------------------------------------------------------------

test("BinarySmlStreamWriter", async () => {
	await deleteFile(testFilePath)
	const templateRootName = "Root"
	const writer = await BinarySmlStreamWriter.create(templateRootName, testFilePath)
	expect(writer.isClosed).toEqual(false)
	expect(writer.existing).toEqual(false)
	await writer.writeNode(new SmlAttribute("Attribute1"))
	await writer.close()
	expect(writer.isClosed).toEqual(true)

	expect((await BinarySmlFile.load(testFilePath)).toString()).toEqual("Root\n\tAttribute1 -\nEnd")

	const appendWriter = await BinarySmlStreamWriter.create(templateRootName, testFilePath, WriterMode.CreateOrAppend)
	expect(appendWriter.existing).toEqual(true)
	await appendWriter.close()

	expect((await BinarySmlFile.loadSync(testFilePath)).toString()).toEqual("Root\n\tAttribute1 -\nEnd")

	const appendWriter2 = await BinarySmlStreamWriter.create(templateRootName, testFilePath, WriterMode.CreateOrAppend)
	await appendWriter2.writeNodes([new SmlAttribute("Attribute2")])
	await appendWriter2.close()
	
	expect((await BinarySmlFile.load(testFilePath)).toString()).toEqual("Root\n\tAttribute1 -\n\tAttribute2 -\nEnd")
})

test("BinarySmlStreamWriter append reader", async () => {
	const document = SmlDocument.parse("Root\n\tAttribute 1\nEnd")
	await BinarySmlFile.save(document, testFilePath)

	const templateRootName = "Root"
	let writer = await BinarySmlStreamWriter.create(templateRootName, testFilePath, WriterMode.CreateOrAppend)
	expect(writer.existing).toEqual(true)
	const reader = await BinarySmlStreamReader.getAppendReader(writer)
	const node1 = await reader.readNode()
	expect(node1?.isAttribute()).toEqual(true)
	expect(await reader.readNode()).toEqual(null)
	await writer.close()

	writer = await BinarySmlStreamWriter.create(templateRootName, testFilePath)
	await expect(async () => await BinarySmlStreamReader.getAppendReader(writer)).rejects.toThrowError()
	await writer.close()
})

// ----------------------------------------------------------------------

test("SyncBinarySmlFileHandle", () => {
	deleteFileSync(testFilePath)
	const handle = SyncBinarySmlFileHandle.createWriter("Root", testFilePath)
	expect(handle.canRead).toEqual(false)
	expect(() => handle.getAllBytes()).toThrow()
	const array = new Uint8Array(0)
	expect(() => handle.readBytes(array, 0, 0)).toThrow()
	handle.close()
	expect(() => handle.getSize()).toThrow()
	expect(() => handle.getAllBytes()).toThrow()
	expect(() => handle.appendNode(new SmlElement("E"))).toThrow()
	expect(() => handle.appendNodes([new SmlElement("E")])).toThrow()
	expect(() => handle.readBytes(array, 0, 0)).toThrow()

	const reader = SyncBinarySmlFileHandle.createReader(testFilePath)
	expect(() => reader.appendNode(new SmlElement("E"))).toThrow()
	expect(() => reader.appendNodes([new SmlElement("E")])).toThrow()
	reader.close()

	writeBytesSync(new Uint8Array([0x42, 0x53, 0x4D, 0x4C, 0x32]), testFilePath)
	expect(() => SyncBinarySmlFileHandle.createReader(testFilePath)).toThrow()
	expect(() => SyncBinarySmlFileHandle.createAppender("Root", testFilePath)).toThrow()
})

// ----------------------------------------------------------------------

test("BinarySmlFileHandle", async () => {
	await deleteFile(testFilePath)
	const handle = await BinarySmlFileHandle.createWriter("Root", testFilePath)
	expect(handle.canRead).toEqual(false)
	await expect(async () => await handle.getAllBytes()).rejects.toThrow()
	const array = new Uint8Array(0)
	await expect(async () => await handle.readBytes(array, 0, 0)).rejects.toThrow()
	await handle.close()
	await expect(async () => await handle.getSize()).rejects.toThrow()
	await expect(async () => await handle.getAllBytes()).rejects.toThrow()
	await expect(async () => await handle.appendNode(new SmlElement("E"))).rejects.toThrow()
	await expect(async () => await handle.appendNodes([new SmlElement("E")])).rejects.toThrow()
	await expect(async () => await handle.readBytes(array, 0, 0)).rejects.toThrow()

	const reader = await BinarySmlFileHandle.createReader(testFilePath)
	await expect(async () => await reader.appendNode(new SmlElement("E"))).rejects.toThrow()
	await expect(async () => await reader.appendNodes([new SmlElement("E")])).rejects.toThrow()
	await reader.close()

	await writeBytes(new Uint8Array([0x42, 0x53, 0x4D, 0x4C, 0x32]), testFilePath)
	await expect(async () => await BinarySmlFileHandle.createReader(testFilePath)).rejects.toThrow()
	await expect(async () => await BinarySmlFileHandle.createAppender("Root", testFilePath)).rejects.toThrow()
})