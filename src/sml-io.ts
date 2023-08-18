/* (C) Stefan John / Stenway / SimpleML.com / 2023 */

import { ReliableTxtFile, ReliableTxtFileHandle, ReliableTxtStreamWriter, ReverseLineIterator, SyncReliableTxtFileHandle, SyncReliableTxtStreamWriter, SyncReverseLineIterator, WriterMode } from "@stenway/reliabletxt-io"
import { ReliableTxtDocument, ReliableTxtEncoding, Utf16String } from "@stenway/reliabletxt"
import { BinarySmlDecoder, BinarySmlEncoder, InvalidBinarySmlError, SmlAttribute, SmlDocument, SmlElement, SmlEmptyNode, SmlNode, SmlParser, SmlParserError, SyncWsvLineIterator, WsvLineIterator } from "@stenway/sml"
import { SyncWsvStreamReader, WsvStreamReader } from "@stenway/wsv-io"
import { VarInt56Decoder, WsvLine, WsvValue } from "@stenway/wsv"
import * as fs from 'node:fs'

// ----------------------------------------------------------------------

export abstract class SmlFile {
	static loadSync(filePath: string, preserveWhitespacesAndComments: boolean = true): SmlDocument {
		const reliableTxtDocument: ReliableTxtDocument = ReliableTxtFile.loadSync(filePath)
		return SmlDocument.parse(reliableTxtDocument.text, preserveWhitespacesAndComments, reliableTxtDocument.encoding)
	}

	static async load(filePath: string, preserveWhitespacesAndComments: boolean = true): Promise<SmlDocument> {
		const reliableTxtDocument: ReliableTxtDocument = await ReliableTxtFile.load(filePath)
		return SmlDocument.parse(reliableTxtDocument.text, preserveWhitespacesAndComments, reliableTxtDocument.encoding)
	}

	static saveSync(document: SmlDocument, filePath: string, preserveWhitespacesAndComments: boolean = true) {
		const text: string = document.toString(preserveWhitespacesAndComments)
		ReliableTxtFile.writeAllTextSync(text, filePath, document.encoding)
	}

	static async save(document: SmlDocument, filePath: string, preserveWhitespacesAndComments: boolean = true) {
		const text: string = document.toString(preserveWhitespacesAndComments)
		await ReliableTxtFile.writeAllText(text, filePath, document.encoding)
	}

	static appendNodesSync(nodes: SmlNode[], templateDocument: SmlDocument, filePath: string, preserveWhitespacesAndComments: boolean = true) {
		if (nodes.length === 0) { return }
		const writer = SyncSmlStreamWriter.create(templateDocument, filePath, WriterMode.CreateOrAppend, preserveWhitespacesAndComments)
		try {
			writer.writeNodes(nodes)
		} finally {
			writer.close()
		}
	}

	static async appendNodes(nodes: SmlNode[], templateDocument: SmlDocument, filePath: string, preserveWhitespacesAndComments: boolean = true) {
		if (nodes.length === 0) { return }
		const writer = await SmlStreamWriter.create(templateDocument, filePath, WriterMode.CreateOrAppend, preserveWhitespacesAndComments)
		try {
			await writer.writeNodes(nodes)
		} finally {
			await writer.close()
		}
	}
}

// ----------------------------------------------------------------------

export class SyncWsvStreamLineIterator implements SyncWsvLineIterator {
	private reader: SyncWsvStreamReader
	private currentLine: WsvLine | null
	private endKeyword: string | null
	private index: number = 0

	private constructor(reader: SyncWsvStreamReader, currentLine: WsvLine | null, endKeyword: string | null) {
		this.reader = reader
		this.currentLine = currentLine
		this.endKeyword = endKeyword
	}

	static create(reader: SyncWsvStreamReader, endKeyword: string | null): SyncWsvStreamLineIterator {
		const currentLine = reader.readLine()
		return new SyncWsvStreamLineIterator(reader, currentLine, endKeyword)
	}

	getEndKeyword(): string | null {
		return this.endKeyword
	}

	hasLine(): boolean {
		return this.currentLine !== null
	}

	isEmptyLine(): boolean {
		if (this.currentLine === null) { throw new Error(`Invalid state`) }
		return this.hasLine() && !this.currentLine.hasValues
	}

	getLine(): WsvLine {
		if (this.currentLine === null) { throw new Error(`Invalid state`) }
		const result: WsvLine = this.currentLine
		this.currentLine = this.reader.readLine()
		this.index++
		return result
	}

	getLineAsArray(): (string | null)[] {
		return this.getLine().values
	}

	toString(): string {
		let result: string = "(" + (this.index+1) + "): "
		if (this.currentLine !== null) {
			result += this.currentLine.toString()
		}
		return result
	}

	getLineIndex(): number {
		return this.index
	}
}

// ----------------------------------------------------------------------

export class WsvStreamLineIterator implements WsvLineIterator {
	private reader: WsvStreamReader
	private currentLine: WsvLine | null
	private endKeyword: string | null
	private index: number = 0

	private constructor(reader: WsvStreamReader, currentLine: WsvLine | null, endKeyword: string | null) {
		this.reader = reader
		this.currentLine = currentLine
		this.endKeyword = endKeyword
	}

	static async create(reader: WsvStreamReader, endKeyword: string | null): Promise<WsvStreamLineIterator> {
		const currentLine = await reader.readLine()
		return new WsvStreamLineIterator(reader, currentLine, endKeyword)
	}

	getEndKeyword(): string | null {
		return this.endKeyword
	}

	async hasLine(): Promise<boolean> {
		return this.currentLine !== null
	}

	async isEmptyLine(): Promise<boolean> {
		if (this.currentLine === null) { throw new Error(`Invalid state`) }
		return (await this.hasLine()) && !this.currentLine.hasValues
	}

	async getLine(): Promise<WsvLine> {
		if (this.currentLine === null) { throw new Error(`Invalid state`) }
		const result: WsvLine = this.currentLine
		this.currentLine = await this.reader.readLine()
		this.index++
		return result
	}

	async getLineAsArray(): Promise<(string | null)[]> {
		return (await this.getLine()).values
	}

	toString(): string {
		let result: string = "(" + (this.index+1) + "): "
		if (this.currentLine !== null) {
			result += this.currentLine.toString()
		}
		return result
	}

	getLineIndex(): number {
		return this.index
	}
}

// ----------------------------------------------------------------------

export class SyncSmlStreamReader {
	readonly root: SmlElement

	private reader: SyncWsvStreamReader
	private endReached: boolean = false
	readonly endKeyword: string | null
	private iterator: SyncWsvStreamLineIterator
	private preserveWhitespacesAndComments: boolean
	private isAppendReader: boolean
	
	readonly emptyNodesBefore: SmlEmptyNode[] = []

	get encoding(): ReliableTxtEncoding {
		return this.reader.encoding
	}

	get isClosed(): boolean {
		return this.reader.isClosed
	}

	get handle(): SyncReliableTxtFileHandle {
		return this.reader.handle
	}
	
	private constructor(reader: SyncWsvStreamReader, root: SmlElement, endKeyword: string | null, iterator: SyncWsvStreamLineIterator, preserveWhitespacesAndComments: boolean, emptyNodesBefore: SmlEmptyNode[], isAppendReader: boolean) {
		this.reader = reader
		this.root = root
		this.endKeyword = endKeyword
		this.iterator = iterator
		this.preserveWhitespacesAndComments = preserveWhitespacesAndComments
		if (!preserveWhitespacesAndComments) { emptyNodesBefore = [] }
		this.emptyNodesBefore = emptyNodesBefore
		this.isAppendReader = isAppendReader
	}
	
	static create(filePath: string, preserveWhitespacesAndComments: boolean = true, chunkSize: number = 4096): SyncSmlStreamReader {
		const reader = SyncWsvStreamReader.create(filePath, preserveWhitespacesAndComments, chunkSize)
		try {
			const result = SmlEndKeywordDetector.getEndKeywordAndPositionSync(reader.handle)
			const endKeyword = result[0]
			
			const iterator = SyncWsvStreamLineIterator.create(reader, endKeyword)
			
			const emptyNodesBefore: SmlEmptyNode[] = []
			const root = SmlParser.readRootElementSync(iterator, emptyNodesBefore)
			return new SyncSmlStreamReader(reader, root, endKeyword, iterator, preserveWhitespacesAndComments, emptyNodesBefore, false)
		} catch (error) {
			reader.close()
			throw error
		}
	}

	static getAppendReader(writer: SyncSmlStreamWriter, preserveWhitespacesAndComments: boolean = true, chunkSize: number = 4096): SyncSmlStreamReader {
		if (!writer.existing) { throw new Error(`Writer is not in append mode`) }
		const reader = SyncWsvStreamReader.getAppendReader(writer.handle, preserveWhitespacesAndComments, chunkSize)
		const iterator = SyncWsvStreamLineIterator.create(reader, writer.endKeyword)
			
		const emptyNodesBefore: SmlEmptyNode[] = []
		const root = SmlParser.readRootElementSync(iterator, emptyNodesBefore)
		return new SyncSmlStreamReader(reader, root, writer.endKeyword, iterator, preserveWhitespacesAndComments, emptyNodesBefore, true)
	}
	
	readNode(): SmlNode | null {
		if (this.endReached || (this.isAppendReader && this.iterator.hasLine() === false)) { return null }
		let result: SmlNode | null = null
		if (!this.preserveWhitespacesAndComments) {
			for (;;) {
				result = SmlParser.readNodeSync(this.iterator, this.root)
				if (result instanceof SmlEmptyNode) { continue }
				break
			}
		} else {
			result = SmlParser.readNodeSync(this.iterator, this.root)
		}
		if (result === null) { this.endReached = true }
		return result
	}

	close() {
		this.reader.close()
	}
}

// ----------------------------------------------------------------------

export class SmlStreamReader {
	readonly root: SmlElement

	private reader: WsvStreamReader
	private endReached: boolean = false
	readonly endKeyword: string | null
	private iterator: WsvStreamLineIterator
	private preserveWhitespacesAndComments: boolean
	private isAppendReader: boolean
	
	readonly emptyNodesBefore: SmlEmptyNode[]

	get encoding(): ReliableTxtEncoding {
		return this.reader.encoding
	}

	get isClosed(): boolean {
		return this.reader.isClosed
	}

	get handle(): ReliableTxtFileHandle {
		return this.reader.handle
	}

	private constructor(reader: WsvStreamReader, root: SmlElement, endKeyword: string | null, iterator: WsvStreamLineIterator, preserveWhitespacesAndComments: boolean, emptyNodesBefore: SmlEmptyNode[], isAppendReader: boolean) {
		this.reader = reader
		this.root = root
		this.endKeyword = endKeyword
		this.iterator = iterator
		this.preserveWhitespacesAndComments = preserveWhitespacesAndComments
		if (!preserveWhitespacesAndComments) { emptyNodesBefore = [] }
		this.emptyNodesBefore = emptyNodesBefore
		this.isAppendReader = isAppendReader
	}
	
	static async create(filePath: string, preserveWhitespacesAndComments: boolean = true, chunkSize: number = 4096): Promise<SmlStreamReader> {
		const reader = await WsvStreamReader.create(filePath, preserveWhitespacesAndComments, chunkSize)
		try {
			const result = await SmlEndKeywordDetector.getEndKeywordAndPosition(reader.handle)
			const endKeyword = result[0]
			
			const iterator = await WsvStreamLineIterator.create(reader, endKeyword)
			
			const emptyNodesBefore: SmlEmptyNode[] = []
			const root = await SmlParser.readRootElement(iterator, emptyNodesBefore)
			return new SmlStreamReader(reader, root, endKeyword, iterator, preserveWhitespacesAndComments, emptyNodesBefore, false)
		} catch (error) {
			await reader.close()
			throw error
		}
	}

	static async getAppendReader(writer: SmlStreamWriter, preserveWhitespacesAndComments: boolean = true, chunkSize: number = 4096): Promise<SmlStreamReader> {
		if (!writer.existing) { throw new Error(`Writer is not in append mode`) }
		const reader = WsvStreamReader.getAppendReader(writer.handle, preserveWhitespacesAndComments, chunkSize)
		const iterator = await WsvStreamLineIterator.create(reader, writer.endKeyword)
			
		const emptyNodesBefore: SmlEmptyNode[] = []
		const root = await SmlParser.readRootElement(iterator, emptyNodesBefore)
		return new SmlStreamReader(reader, root, writer.endKeyword, iterator, preserveWhitespacesAndComments, emptyNodesBefore, true)
	}
	
	async readNode(): Promise<SmlNode | null> {
		if (this.endReached || (this.isAppendReader && (await this.iterator.hasLine()) === false)) { return null }
		let result: SmlNode | null = null
		if (!this.preserveWhitespacesAndComments) {
			for (;;) {
				result = await SmlParser.readNode(this.iterator, this.root)
				if (result instanceof SmlEmptyNode) { continue }
				break
			}
		} else {
			result = await SmlParser.readNode(this.iterator, this.root)
		}
		if (result === null) { this.endReached = true }
		return result
	}

	async close() {
		await this.reader.close()
	}
}

// ----------------------------------------------------------------------

abstract class SmlEndKeywordDetector {
	static getEndKeywordAndPositionSync(handle: SyncReliableTxtFileHandle): [string | null, number] {
		try {
			let endKeyword: string | null
			const iterator: SyncReverseLineIterator = SyncReverseLineIterator.create(handle)
			for (;;) {
				const lineStr: string = iterator.getLine()
				const line: WsvLine = WsvLine.parse(lineStr)
				if (line.hasValues) {
					if (line.values.length > 1) {
						throw new SmlParserError(-1, "Invalid end line")
					}
					endKeyword = line.values[0]
					break
				}
			}
			const remainingLength: number = iterator.getPosition() + 1
			return [endKeyword, remainingLength]
		} catch(error) {
			throw new Error(`Could not detect end keyword: ${error}`)
		}
	}

	static async getEndKeywordAndPosition(handle: ReliableTxtFileHandle): Promise<[string | null, number]> {
		try {
			let endKeyword: string | null
			const iterator: ReverseLineIterator = await ReverseLineIterator.create(handle)
			for (;;) {
				const lineStr: string = await iterator.getLine()
				const line: WsvLine = WsvLine.parse(lineStr)
				if (line.hasValues) {
					if (line.values.length > 1) {
						throw new SmlParserError(-1, "Invalid end line")
					}
					endKeyword = line.values[0]
					break
				}
			}
			const remainingLength: number = iterator.getPosition() + 1
			return [endKeyword, remainingLength]
		} catch(error) {
			throw new Error(`Could not detect end keyword: ${error}`)
		}
	}
}

// ----------------------------------------------------------------------

export class SyncSmlStreamWriter {
	private writer: SyncReliableTxtStreamWriter
	readonly endKeyword: string | null
	private defaultIndentation: string | null
	private preserveWhitespacesAndComments: boolean
	
	get encoding(): ReliableTxtEncoding {
		return this.writer.encoding
	}

	get isClosed(): boolean {
		return this.writer.isClosed
	}

	get handle(): SyncReliableTxtFileHandle {
		return this.writer.handle
	}

	get existing(): boolean {
		return this.writer.existing
	}

	private constructor(writer: SyncReliableTxtStreamWriter, defaultIndentation: string | null, preserveWhitespacesAndComment: boolean, endKeyword: string | null) {
		this.writer = writer
		this.defaultIndentation = defaultIndentation
		this.preserveWhitespacesAndComments = preserveWhitespacesAndComment
		this.endKeyword = endKeyword
	}

	static create(templateDocument: SmlDocument, filePath: string, mode: WriterMode = WriterMode.CreateOrOverwrite, preserveWhitespacesAndComment: boolean = true): SyncSmlStreamWriter {
		const writer = SyncReliableTxtStreamWriter.create(filePath, templateDocument.encoding, mode)
		let endKeyword: string | null
		try {
			if (writer.existing) {
				const result = SmlEndKeywordDetector.getEndKeywordAndPositionSync(writer.handle)
				endKeyword = result[0]
				const restLength = result[1]
				writer.internalTruncate(restLength)
			} else {
				endKeyword = templateDocument.endKeyword
				const rootElementName: string = templateDocument.root.name
				writer.writeLine(WsvValue.serialize(rootElementName))
			}
		} catch (error) {
			writer.close()
			throw error
		}
		return new SyncSmlStreamWriter(writer, templateDocument.defaultIndentation, preserveWhitespacesAndComment, endKeyword)
	}
	
	writeNode(node: SmlNode) {
		const lines: string[] = []
		node.internalSerialize(lines, 1, this.defaultIndentation, this.endKeyword, this.preserveWhitespacesAndComments)
		this.writer.writeLines(lines)
	}

	writeNodes(nodes: SmlNode[]) {
		for (const node of nodes) {
			this.writeNode(node)
		}
	}

	close() {
		if (!this.writer.isClosed) {	
			this.writer.writeLine(WsvValue.serialize(this.endKeyword))
			this.writer.close()
		}
	}
}

// ----------------------------------------------------------------------

export class SmlStreamWriter {
	private writer: ReliableTxtStreamWriter
	readonly endKeyword: string | null
	private defaultIndentation: string | null
	private preserveWhitespacesAndComments: boolean
	
	get encoding(): ReliableTxtEncoding {
		return this.writer.encoding
	}

	get isClosed(): boolean {
		return this.writer.isClosed
	}

	get handle(): ReliableTxtFileHandle {
		return this.writer.handle
	}

	get existing(): boolean {
		return this.writer.existing
	}

	private constructor(writer: ReliableTxtStreamWriter, defaultIndentation: string | null, preserveWhitespacesAndComment: boolean, endKeyword: string | null) {
		this.writer = writer
		this.defaultIndentation = defaultIndentation
		this.preserveWhitespacesAndComments = preserveWhitespacesAndComment
		this.endKeyword = endKeyword
	}

	static async create(templateDocument: SmlDocument, filePath: string, mode: WriterMode = WriterMode.CreateOrOverwrite, preserveWhitespacesAndComment: boolean = true): Promise<SmlStreamWriter> {
		const writer = await ReliableTxtStreamWriter.create(filePath, templateDocument.encoding, mode)
		let endKeyword: string | null
		try {
			if (writer.existing) {
				const result = await SmlEndKeywordDetector.getEndKeywordAndPosition(writer.handle)
				endKeyword = result[0]
				const restLength = result[1]
				await writer.internalTruncate(restLength)
			} else {
				endKeyword = templateDocument.endKeyword
				const rootElementName: string = templateDocument.root.name
				await writer.writeLine(WsvValue.serialize(rootElementName))
			}
		} catch (error) {
			await writer.close()
			throw error
		}
		return new SmlStreamWriter(writer, templateDocument.defaultIndentation, preserveWhitespacesAndComment, endKeyword)
	}
	
	async writeNode(node: SmlNode) {
		const lines: string[] = []
		node.internalSerialize(lines, 1, this.defaultIndentation, this.endKeyword, this.preserveWhitespacesAndComments)
		await this.writer.writeLines(lines)
	}

	async writeNodes(nodes: SmlNode[]) {
		for (const node of nodes) {
			await this.writeNode(node)
		}
	}

	async close() {
		if (!this.writer.isClosed) {	
			await this.writer.writeLine(WsvValue.serialize(this.endKeyword))
			await this.writer.close()
		}
	}
}

// ----------------------------------------------------------------------

export class SyncBinarySmlFileHandle {
	private handle: number | null
	private mode: number
	readonly preambleSize: number
	readonly existing: boolean

	get isClosed(): boolean {
		return this.handle === null
	}

	get canRead(): boolean {
		return this.mode === 0 || this.mode === 2
	}

	get canWrite(): boolean {
		return this.mode === 1 || this.mode === 2
	}
	
	private constructor(handle: number, preambleSize: number, mode: number, existing: boolean) {
		this.handle = handle
		this.preambleSize = preambleSize
		this.mode = mode
		this.existing = existing
	}

	getSize(): number {
		if (this.handle === null) { throw new Error(`File handle closed`) }
		return fs.fstatSync(this.handle).size
	}

	getAllBytes(): Uint8Array {
		if (this.handle === null) { throw new Error(`File handle closed`) }
		if (!this.canRead) { throw new Error(`Not a reader`) }
		const fileSize: number = this.getSize()
		const buffer: Uint8Array = new Uint8Array(fileSize)
		const numBytesRead: number = fs.readSync(this.handle, buffer, 0, fileSize, 0)
		if (numBytesRead !== fileSize) { throw new Error(`File was not fully read`) }
		return buffer
	}

	appendNode(node: SmlNode) {
		if (this.handle === null) { throw new Error(`File handle closed`) }
		if (!this.canWrite) { throw new Error(`Not a writer`) }
		const fileSize = this.getSize()
		const bytes: Uint8Array = BinarySmlEncoder.encodeNode(node)
		const numBytesWritten: number = fs.writeSync(this.handle, bytes, 0, bytes.length, fileSize)
		if (numBytesWritten !== bytes.length) { throw new Error(`Node was not fully written`) }
	}

	appendNodes(nodes: SmlNode[]) {
		if (this.handle === null) { throw new Error(`File handle closed`) }
		if (!this.canWrite) { throw new Error(`Not a writer`) }
		const fileSize = this.getSize()
		const bytes: Uint8Array = BinarySmlEncoder.encodeNodes(nodes)
		const numBytesWritten: number = fs.writeSync(this.handle, bytes, 0, bytes.length, fileSize)
		if (numBytesWritten !== bytes.length) { throw new Error(`Nodes were not fully written`) }
	}

	readBytes(buffer: Uint8Array, offset: number, length: number, position: number | null = null): number {
		if (this.handle === null) { throw new Error(`File handle closed`) }
		if (!this.canRead) { throw new Error(`Not a reader`) }
		return fs.readSync(this.handle, buffer, offset, length, position)
	}
	
	close() {
		if (this.handle !== null) {
			fs.closeSync(this.handle)
			this.handle = null
		}
	}

	static createReader(filePath: string): SyncBinarySmlFileHandle {
		const handle = fs.openSync(filePath, "r")
		try {
			const version = this.getVersion(handle)
			if (version !== "1") {
				throw new Error(`Not supported BinarySML version '${version}'`)
			}
			return new SyncBinarySmlFileHandle(handle, 5, 0, true)
		} catch(error) {
			fs.closeSync(handle)
			throw error
		}
	}

	static createWriter(templateRootElementName: string, filePath: string, overwriteExisting: boolean = true): SyncBinarySmlFileHandle {
		const handle = fs.openSync(filePath, overwriteExisting ? "w" : "wx")
		try {
			const headerBytes = BinarySmlEncoder.encodeElement(new SmlElement(templateRootElementName), true)
			const numBytesWritten: number = fs.writeSync(handle, headerBytes, 0, headerBytes.length, 0)
			if (numBytesWritten !== headerBytes.length) { throw new Error(`Header was not fully written`) }
			return new SyncBinarySmlFileHandle(handle, headerBytes.length, 1, false)
		} catch(error) {
			fs.closeSync(handle)
			throw error
		}
	}

	static createAppender(templateRootElementName: string, filePath: string): SyncBinarySmlFileHandle {
		try {
			const handle = fs.openSync(filePath, "r+")
			try {
				const version = this.getVersion(handle)
				if (version !== "1") {
					throw new Error(`Not supported BinarySML version '${version}'`)
				}
				return new SyncBinarySmlFileHandle(handle, 5, 2, true)
			} catch(error) {
				fs.closeSync(handle)
				throw error
			}
		} catch (error) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			if ((error as any).code === "ENOENT") {
				return this.createWriter(templateRootElementName, filePath, false)
			} else {
				throw error
			}
		}
	}

	private static getVersion(handle: number): string {
		let buffer: Uint8Array = new Uint8Array(5)
		const numBytesRead = fs.readSync(handle, buffer, 0, 5, 0)
		buffer = buffer.slice(0, numBytesRead)
		return BinarySmlDecoder.getVersion(buffer)
	}
}

// ----------------------------------------------------------------------

export class BinarySmlFileHandle {
	private handle: fs.promises.FileHandle | null
	private mode: number
	readonly preambleSize: number
	readonly existing: boolean

	get isClosed(): boolean {
		return this.handle === null
	}

	get canRead(): boolean {
		return this.mode === 0 || this.mode === 2
	}

	get canWrite(): boolean {
		return this.mode === 1 || this.mode === 2
	}

	private constructor(handle: fs.promises.FileHandle, preambleSize: number, mode: number, existing: boolean) {
		this.handle = handle
		this.preambleSize = preambleSize
		this.mode = mode
		this.existing = existing
	}

	async getSize(): Promise<number> {
		if (this.handle === null) { throw new Error(`File handle closed`) }
		const stats = await this.handle.stat()
		return stats.size
	}

	async getAllBytes(): Promise<Uint8Array> {
		if (this.handle === null) { throw new Error(`File handle closed`) }
		if (!this.canRead) { throw new Error(`Not a reader`) }
		const fileSize: number = await this.getSize()
		const buffer: Uint8Array = new Uint8Array(fileSize)
		const result = await this.handle.read(buffer, 0, fileSize, 0)
		if (result.bytesRead !== fileSize) { throw new Error(`File was not fully read`) }
		return buffer
	}

	async appendNode(node: SmlNode) {
		if (this.handle === null) { throw new Error(`File handle closed`) }
		if (!this.canWrite) { throw new Error(`Not a writer`) }
		const fileSize = await this.getSize()
		const bytes: Uint8Array = BinarySmlEncoder.encodeNode(node)
		const result = await this.handle.write(bytes, 0, bytes.length, fileSize)
		if (result.bytesWritten !== bytes.length) { throw new Error(`Node was not fully written`) }
	}

	async appendNodes(nodes: SmlNode[]) {
		if (this.handle === null) { throw new Error(`File handle closed`) }
		if (!this.canWrite) { throw new Error(`Not a writer`) }
		const fileSize = await this.getSize()
		const bytes: Uint8Array = BinarySmlEncoder.encodeNodes(nodes)
		const result = await this.handle.write(bytes, 0, bytes.length, fileSize)
		if (result.bytesWritten !== bytes.length) { throw new Error(`Nodes were not fully written`) }
	}

	async readBytes(buffer: Uint8Array, offset: number, length: number, position: number | null = null): Promise<number> {
		if (this.handle === null) { throw new Error(`File handle closed`) }
		if (!this.canRead) { throw new Error(`Not a reader`) }
		const result = await this.handle.read(buffer, offset, length, position)
		return result.bytesRead
	}
	
	async close() {
		if (this.handle !== null) {
			await this.handle.close()
			this.handle = null
		}
	}

	static async createReader(filePath: string): Promise<BinarySmlFileHandle> {
		const handle = await fs.promises.open(filePath, "r")
		try {
			const version = await this.getVersion(handle)
			if (version !== "1") {
				throw new Error(`Not supported BinarySML version '${version}'`)
			}
			return new BinarySmlFileHandle(handle, 5, 0, true)
		} catch(error) {
			await handle.close()
			throw error
		}
	}
	
	static async createWriter(templateRootElementName: string, filePath: string, overwriteExisting: boolean = true): Promise<BinarySmlFileHandle> {
		const handle = await fs.promises.open(filePath, overwriteExisting ? "w" : "wx")
		try {
			const headerBytes = BinarySmlEncoder.encodeElement(new SmlElement(templateRootElementName), true)
			const result = await handle.write(headerBytes, 0, headerBytes.length, 0)
			if (result.bytesWritten !== headerBytes.length) { throw new Error(`Header was not fully written`) }
			return new BinarySmlFileHandle(handle, headerBytes.length, 1, false)
		} catch(error) {
			await handle.close()
			throw error
		}
	}

	static async createAppender(templateRootElementName: string, filePath: string): Promise<BinarySmlFileHandle> {
		try {
			const handle = await fs.promises.open(filePath, "r+")
			try {
				const version = await this.getVersion(handle)
				if (version !== "1") {
					throw new Error(`Not supported BinarySML version '${version}'`)
				}
				return new BinarySmlFileHandle(handle, 5, 2, true)
			} catch(error) {
				await handle.close()
				throw error
			}
		} catch (error) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			if ((error as any).code === "ENOENT") {
				return await this.createWriter(templateRootElementName, filePath, false)
			} else {
				throw error
			}
		}
	}

	private static async getVersion(handle: fs.promises.FileHandle): Promise<string> {
		let buffer: Uint8Array = new Uint8Array(5)
		const result = await handle.read(buffer, 0, 5, 0)
		buffer = buffer.slice(0, result.bytesRead)
		return BinarySmlDecoder.getVersion(buffer)
	}
}

// ----------------------------------------------------------------------

export abstract class BinarySmlFile {
	static loadSync(filePath: string): SmlDocument {
		const handle = SyncBinarySmlFileHandle.createReader(filePath)
		try {
			const bytes = handle.getAllBytes()
			return BinarySmlDecoder.decode(bytes)
		} finally {
			handle.close()
		}
	}

	static async load(filePath: string): Promise<SmlDocument> {
		const handle = await BinarySmlFileHandle.createReader(filePath)
		try {
			const bytes = await handle.getAllBytes()
			return BinarySmlDecoder.decode(bytes)
		} finally {
			await handle.close()
		}
	}
	
	static saveSync(document: SmlDocument, filePath: string, overwriteExisting: boolean = true) {
		const handle = fs.openSync(filePath, overwriteExisting ? "w" : "wx")
		try {
			const bytes = document.toBinarySml()
			const numBytesWritten: number = fs.writeSync(handle, bytes, 0, bytes.length, 0)
			if (numBytesWritten !== bytes.length) { throw new Error(`Document was not fully written`) }
		} finally {
			fs.closeSync(handle)
		}
	}
	
	static async save(document: SmlDocument, filePath: string, overwriteExisting: boolean = true) {
		const handle = await fs.promises.open(filePath, overwriteExisting ? "w" : "wx")
		try {
			const bytes = document.toBinarySml()
			const result = await handle.write(bytes, 0, bytes.length, 0)
			if (result.bytesWritten !== bytes.length) { throw new Error(`Document was not fully written`) }
		} finally {
			await handle.close()
		}
	}
	
	static appendNodesSync(nodes: SmlNode[], templateRootElementName: string, filePath: string) {
		if (nodes.length === 0) { return }
		const handle = SyncBinarySmlFileHandle.createAppender(templateRootElementName, filePath)
		try {
			handle.appendNodes(nodes)
		} finally {
			handle.close()
		}
	}

	static async appendNodes(nodes: SmlNode[], templateRootElementName: string, filePath: string) {
		if (nodes.length === 0) { return }
		const handle = await BinarySmlFileHandle.createAppender(templateRootElementName, filePath)
		try {
			await handle.appendNodes(nodes)
		} finally {
			await handle.close()
		}
	}
}

// ----------------------------------------------------------------------

export class SyncBinarySmlStreamReader {
	readonly root: SmlElement

	readonly handle: SyncBinarySmlFileHandle
	private position: number
	private size: number

	private chunkSize: number
	private bufferOffset: number
	private buffer: Uint8Array
	private bufferSize: number = 0

	get isClosed(): boolean {
		return this.handle.isClosed
	}

	private constructor(handle: SyncBinarySmlFileHandle, chunkSize: number) {
		if (chunkSize < 32) { throw new RangeError("Chunk size too small") }
		this.handle = handle

		this.position = handle.preambleSize
		this.size = handle.getSize()

		this.chunkSize = chunkSize
		this.buffer = new Uint8Array(chunkSize)
		this.bufferOffset = this.position
		this.bufferSize = 0

		this.root = new SmlElement("Root")
	}

	static create(filePath: string, chunkSize: number = 4096): SyncBinarySmlStreamReader {
		const handle = SyncBinarySmlFileHandle.createReader(filePath)
		try {
			const reader = new SyncBinarySmlStreamReader(handle, chunkSize)
			reader.readHead()			
			return reader
		} catch(error) {
			handle.close()
			throw error
		}
	}

	static getAppendReader(writer: SyncBinarySmlStreamWriter, chunkSize: number = 4096): SyncBinarySmlStreamReader {
		if (!writer.existing) { throw new Error(`Writer is not in append mode`) }
		const reader = new SyncBinarySmlStreamReader(writer.handle, chunkSize)
		reader.readHead()			
		return reader
	}

	private readHead() {
		const elementVarInt = this.readVarInt56()
		if ((elementVarInt & 0b1) === 1) { throw new InvalidBinarySmlError() }
		this.root.name = elementVarInt === 0b10 ? "" : this.readString((elementVarInt >> 1) - 1)
	}

	get hasBytes(): boolean {
		return this.position < this.size
	}

	private readVarInt56(): number {
		if (this.position >= this.bufferOffset + this.bufferSize - 10) {
			this.bufferSize = this.handle.readBytes(this.buffer, 0, this.chunkSize, this.position)
			this.bufferOffset = this.position
		}
		const [varIntValue, varIntLength] = VarInt56Decoder.decode(this.buffer, this.position - this.bufferOffset)
		this.position += varIntLength

		return varIntValue
	}

	private readString(numBytes: number): string {
		if (this.position + numBytes >= this.bufferOffset + this.bufferSize) {
			if (numBytes > this.chunkSize) {
				this.chunkSize = numBytes + 10
				this.buffer = new Uint8Array(this.chunkSize)	
			}
			this.bufferSize = this.handle.readBytes(this.buffer, 0, this.chunkSize, this.position)
			this.bufferOffset = this.position
			if (this.bufferSize < numBytes) { throw new Error("Could not read string value") }
		}
		const valueBytes = this.buffer.subarray(this.position - this.bufferOffset, this.position - this.bufferOffset + numBytes)
		this.position += numBytes
		return Utf16String.fromUtf8Bytes(valueBytes)
	}

	private readValue(values: (string | null)[]): boolean {
		const varInt = this.readVarInt56()
		if (varInt === 0) {
			return true
		} else if (varInt === 1) {
			values.push(null)
		} else if (varInt === 2) {
			values.push("")
		} else {
			const valueLength = varInt - 2
			const strValue = this.readString(valueLength)
			values.push(strValue)
		}
		return false
	}

	private readAttribute(attributeVarInt: number): SmlAttribute {
		const attributeName = attributeVarInt === 0b1 ? "" : this.readString(attributeVarInt >> 1)

		const values: (string | null)[] = []
		while (this.hasBytes) {
			const wasAttributeEnd = this.readValue(values)
			if (wasAttributeEnd === true) {
				return new SmlAttribute(attributeName, values)
			}
		}
		throw new InvalidBinarySmlError() 
	}

	private readElement(elementVarInt: number): SmlElement {
		const elementName = elementVarInt === 0b10 ? "" : this.readString((elementVarInt >> 1) - 1)
		const element = new SmlElement(elementName)
		
		while (this.hasBytes) {
			const varInt = this.readVarInt56()
			if (varInt === 0) {
				return element
			} else if ((varInt & 0b1) === 0) {
				const childElement = this.readElement(varInt)
				element.addNode(childElement)
			} else {
				const childAttribute = this.readAttribute(varInt)
				element.addNode(childAttribute)
			}
		}
		throw new InvalidBinarySmlError()
	}

	readNode(): SmlNode | null {
		if (this.hasBytes === false) { return null }
		const varInt = this.readVarInt56()
		if (varInt === 0) {
			throw new InvalidBinarySmlError()
		} else if ((varInt & 0b1) === 0) {
			return this.readElement(varInt)
		} else {
			return this.readAttribute(varInt)
		}
	}

	close() {
		this.handle.close()
	}
}

// ----------------------------------------------------------------------

export class BinarySmlStreamReader {
	readonly root: SmlElement

	readonly handle: BinarySmlFileHandle
	private position: number
	private size: number

	private chunkSize: number
	private bufferOffset: number
	private buffer: Uint8Array
	private bufferSize: number = 0

	get isClosed(): boolean {
		return this.handle.isClosed
	}

	private constructor(handle: BinarySmlFileHandle, size: number, chunkSize: number) {
		if (chunkSize < 32) { throw new RangeError("Chunk size too small") }
		this.handle = handle
		this.position = handle.preambleSize
		this.size = size

		this.chunkSize = chunkSize
		this.buffer = new Uint8Array(chunkSize)
		this.bufferOffset = this.position
		this.bufferSize = 0

		this.root = new SmlElement("Root")
	}

	static async create(filePath: string, chunkSize: number = 4096): Promise<BinarySmlStreamReader> {
		const handle = await BinarySmlFileHandle.createReader(filePath)
		try {
			const size = await handle.getSize()
			const reader = new BinarySmlStreamReader(handle, size, chunkSize)
			await reader.readHead()
			return reader
		} catch(error) {
			await handle.close()
			throw error
		}
	}

	static async getAppendReader(writer: BinarySmlStreamWriter, chunkSize: number = 4096): Promise<BinarySmlStreamReader> {
		if (!writer.existing) { throw new Error(`Writer is not in append mode`) }
		const size = await writer.handle.getSize()
		const reader = new BinarySmlStreamReader(writer.handle, size, chunkSize)
		await reader.readHead()			
		return reader
	}

	private async readHead() {
		const elementVarInt = await this.readVarInt56()
		if ((elementVarInt & 0b1) === 1) { throw new InvalidBinarySmlError() }
		this.root.name = elementVarInt === 0b10 ? "" : await this.readString((elementVarInt >> 1) - 1)
	}
	
	get hasBytes(): boolean {
		return this.position < this.size
	}

	private async readVarInt56(): Promise<number> {
		if (this.position >= this.bufferOffset + this.bufferSize - 10) {
			this.bufferSize = await this.handle.readBytes(this.buffer, 0, this.chunkSize, this.position)
			this.bufferOffset = this.position
		}
		const [varIntValue, varIntLength] = VarInt56Decoder.decode(this.buffer, this.position - this.bufferOffset)
		this.position += varIntLength

		return varIntValue
	}

	private async readString(numBytes: number): Promise<string> {
		if (this.position + numBytes >= this.bufferOffset + this.bufferSize) {
			if (numBytes > this.chunkSize) {
				this.chunkSize = numBytes + 10
				this.buffer = new Uint8Array(this.chunkSize)	
			}
			this.bufferSize = await this.handle.readBytes(this.buffer, 0, this.chunkSize, this.position)
			this.bufferOffset = this.position
			if (this.bufferSize < numBytes) { throw new Error("Could not read string value") }
		}
		const valueBytes = this.buffer.subarray(this.position - this.bufferOffset, this.position - this.bufferOffset + numBytes)
		this.position += numBytes
		return Utf16String.fromUtf8Bytes(valueBytes)
	}

	private async readValue(values: (string | null)[]): Promise<boolean> {
		const varInt = await this.readVarInt56()
		if (varInt === 0) {
			return true
		} else if (varInt === 1) {
			values.push(null)
		} else if (varInt === 2) {
			values.push("")
		} else {
			const valueLength = varInt - 2
			const strValue = await this.readString(valueLength)
			values.push(strValue)
		}
		return false
	}

	private async readAttribute(attributeVarInt: number): Promise<SmlAttribute> {
		const attributeName = attributeVarInt === 0b1 ? "" : await this.readString(attributeVarInt >> 1)

		const values: (string | null)[] = []
		while (this.hasBytes) {
			const wasAttributeEnd = await this.readValue(values)
			if (wasAttributeEnd === true) {
				return new SmlAttribute(attributeName, values)
			}
		}
		throw new InvalidBinarySmlError() 
	}

	private async readElement(elementVarInt: number): Promise<SmlElement> {
		const elementName = elementVarInt === 0b10 ? "" : await this.readString((elementVarInt >> 1) - 1)
		const element = new SmlElement(elementName)
		
		while (this.hasBytes) {
			const varInt = await this.readVarInt56()
			if (varInt === 0) {
				return element
			} else if ((varInt & 0b1) === 0) {
				const childElement = await this.readElement(varInt)
				element.addNode(childElement)
			} else {
				const childAttribute = await this.readAttribute(varInt)
				element.addNode(childAttribute)
			}
		}
		throw new InvalidBinarySmlError()
	}

	async readNode(): Promise<SmlNode | null> {
		if (this.hasBytes === false) { return null }
		const varInt = await this.readVarInt56()
		if (varInt === 0) {
			throw new InvalidBinarySmlError()
		} else if ((varInt & 0b1) === 0) {
			return await this.readElement(varInt)
		} else {
			return await this.readAttribute(varInt)
		}
	}

	async close() {
		await this.handle.close()
	}
}

// ----------------------------------------------------------------------

export class SyncBinarySmlStreamWriter {
	readonly handle: SyncBinarySmlFileHandle
	
	get isClosed(): boolean {
		return this.handle.isClosed
	}

	get existing(): boolean {
		return this.handle.existing
	}

	private constructor(handle: SyncBinarySmlFileHandle) {
		this.handle = handle
	}

	static create(templateRootElementName: string, filePath: string, mode: WriterMode = WriterMode.CreateOrOverwrite): SyncBinarySmlStreamWriter {
		if (mode === WriterMode.CreateOrAppend) {
			const handle = SyncBinarySmlFileHandle.createAppender(templateRootElementName, filePath)
			try {
				return new SyncBinarySmlStreamWriter(handle)
			} catch(error) {
				handle.close()
				throw error
			}
		} else {
			const overwriteExisting = mode === WriterMode.CreateOrOverwrite
			const handle = SyncBinarySmlFileHandle.createWriter(templateRootElementName, filePath, overwriteExisting)
			try {
				return new SyncBinarySmlStreamWriter(handle)
			} catch(error) {
				handle.close()
				throw error
			}
		}
	}

	writeNode(node: SmlNode) {
		this.handle.appendNode(node)
	}

	writeNodes(nodes: SmlNode[]) {
		this.handle.appendNodes(nodes)
	}

	close() {
		this.handle.close()
	}
}

// ----------------------------------------------------------------------

export class BinarySmlStreamWriter {
	readonly handle: BinarySmlFileHandle
	
	get isClosed(): boolean {
		return this.handle.isClosed
	}

	get existing(): boolean {
		return this.handle.existing
	}

	private constructor(handle: BinarySmlFileHandle) {
		this.handle = handle
	}

	static async create(templateRootElementName: string, filePath: string, mode: WriterMode = WriterMode.CreateOrOverwrite): Promise<BinarySmlStreamWriter> {
		if (mode === WriterMode.CreateOrAppend) {
			const handle = await BinarySmlFileHandle.createAppender(templateRootElementName, filePath)
			try {
				return new BinarySmlStreamWriter(handle)
			} catch(error) {
				await handle.close()
				throw error
			}
		} else {
			const overwriteExisting = mode === WriterMode.CreateOrOverwrite
			const handle = await BinarySmlFileHandle.createWriter(templateRootElementName, filePath, overwriteExisting)
			try {
				return new BinarySmlStreamWriter(handle)
			} catch(error) {
				await handle.close()
				throw error
			}
		}
	}

	async writeNode(node: SmlNode) {
		await this.handle.appendNode(node)
	}

	async writeNodes(nodes: SmlNode[]) {
		await this.handle.appendNodes(nodes)
	}
	
	async close() {
		await this.handle.close()
	}
}