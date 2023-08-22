/* (C) Stefan John / Stenway / SimpleML.com / 2023 */

import { ReliableTxtFile, ReliableTxtFileHandle, ReliableTxtStreamWriter, ReverseLineIterator, SyncReliableTxtFileHandle, SyncReliableTxtStreamWriter, SyncReverseLineIterator, WriterMode } from "@stenway/reliabletxt-io"
import { ReliableTxtDocument, ReliableTxtEncoding } from "@stenway/reliabletxt"
import { BinarySmlDecoder, BinarySmlEncoder, InvalidBinarySmlError, SmlDocument, SmlElement, SmlEmptyNode, SmlNode, SmlParser, SmlParserError, SyncWsvLineIterator, Uint8ArrayReader, WsvLineIterator } from "@stenway/sml"
import { SyncWsvStreamReader, WsvStreamReader } from "@stenway/wsv-io"
import { Uint8ArrayBuilder, WsvLine, WsvValue } from "@stenway/wsv"
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
	private builder: Uint8ArrayBuilder

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
		this.builder = new Uint8ArrayBuilder()
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
		this.builder.reset()
		BinarySmlEncoder.internalEncodeNode(node, this.builder)
		const bytes: Uint8Array = this.builder.toArray()
		const numBytesWritten: number = fs.writeSync(this.handle, bytes, 0, bytes.length, fileSize)
		if (numBytesWritten !== bytes.length) { throw new Error(`Node was not fully written`) }
	}

	appendNodes(nodes: SmlNode[]) {
		if (this.handle === null) { throw new Error(`File handle closed`) }
		if (!this.canWrite) { throw new Error(`Not a writer`) }
		const fileSize = this.getSize()
		this.builder.reset()
		BinarySmlEncoder.internalEncodeNodes(nodes, this.builder)
		const bytes: Uint8Array = this.builder.toArray()
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
			return new SyncBinarySmlFileHandle(handle, 3, 0, true)
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
				return new SyncBinarySmlFileHandle(handle, 3, 2, true)
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
		let buffer: Uint8Array = new Uint8Array(3)
		const numBytesRead = fs.readSync(handle, buffer, 0, 3, 0)
		buffer = buffer.subarray(0, numBytesRead)
		return BinarySmlDecoder.getVersion(buffer)
	}
}

// ----------------------------------------------------------------------

export class BinarySmlFileHandle {
	private handle: fs.promises.FileHandle | null
	private mode: number
	readonly preambleSize: number
	readonly existing: boolean
	private builder: Uint8ArrayBuilder

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
		this.builder = new Uint8ArrayBuilder()
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
		this.builder.reset()
		BinarySmlEncoder.internalEncodeNode(node, this.builder)
		const bytes: Uint8Array = this.builder.toArray()
		const result = await this.handle.write(bytes, 0, bytes.length, fileSize)
		if (result.bytesWritten !== bytes.length) { throw new Error(`Node was not fully written`) }
	}

	async appendNodes(nodes: SmlNode[]) {
		if (this.handle === null) { throw new Error(`File handle closed`) }
		if (!this.canWrite) { throw new Error(`Not a writer`) }
		const fileSize = await this.getSize()
		this.builder.reset()
		BinarySmlEncoder.internalEncodeNodes(nodes, this.builder)
		const bytes: Uint8Array = this.builder.toArray()
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
			return new BinarySmlFileHandle(handle, 3, 0, true)
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
				return new BinarySmlFileHandle(handle, 3, 2, true)
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
		let buffer: Uint8Array = new Uint8Array(3)
		const result = await handle.read(buffer, 0, 3, 0)
		buffer = buffer.subarray(0, result.bytesRead)
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
	private buffer: Uint8Array
	private rest: Uint8Array | null = new Uint8Array(0)
	private reader: Uint8ArrayReader

	get isClosed(): boolean {
		return this.handle.isClosed
	}

	private constructor(handle: SyncBinarySmlFileHandle, chunkSize: number) {
		if (chunkSize < 32) { throw new RangeError("Chunk size too small") }
		this.handle = handle

		this.position = handle.preambleSize
		this.buffer = new Uint8Array(chunkSize)

		this.reader = new Uint8ArrayReader(new Uint8Array(), 0)

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
		const numBytesRead: number = this.handle.readBytes(this.buffer, 0, this.buffer.length, this.position)
		if (numBytesRead === 0) { throw new InvalidBinarySmlError() }
		const partialBuffer = this.buffer.subarray(0, numBytesRead)
		this.reader.reset(partialBuffer, 0)
		this.root.name = this.reader.readRootElementStart()
		this.position += numBytesRead
		this.rest = partialBuffer.slice(this.reader.offset)
	}

	private readNodeBuffer(): Uint8Array | null {
		if (this.rest === null) { return null }

		let lastStartIndex: number = 0
		let current: Uint8Array = this.rest
		for (;;) {
			const endIndex = BinarySmlDecoder.internalGetNodeEndIndex(current, lastStartIndex)
			
			if (endIndex >= 0) {
				const nodeBytes: Uint8Array = current.subarray(0, endIndex+1)
				this.rest = current.subarray(endIndex+1)
				return nodeBytes
			} else {
				lastStartIndex = current.length
				const numBytesRead: number = this.handle.readBytes(this.buffer, 0, this.buffer.length, this.position)
				if (numBytesRead === 0) {
					this.rest = null
					if (current.length === 0) { return null }
					return current
				}
				this.position += numBytesRead

				const newCurrent: Uint8Array = new Uint8Array(current.length + numBytesRead)
				newCurrent.set(current, 0)
				if (numBytesRead < this.buffer.length) {
					newCurrent.set(this.buffer.subarray(0, numBytesRead), current.length)
				} else {
					newCurrent.set(this.buffer, current.length)
				}
				current = newCurrent
			}
		}
	}

	readNode(): SmlNode | null {
		if (this.handle.isClosed) { throw new Error("Stream reader is closed") }

		const nodeBuffer = this.readNodeBuffer()
		if (nodeBuffer === null) { return null }
		this.reader.reset(nodeBuffer, 0)
		return BinarySmlDecoder.internalDecodeNode(this.reader)
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
	private buffer: Uint8Array
	private rest: Uint8Array | null = new Uint8Array(0)
	private reader: Uint8ArrayReader

	get isClosed(): boolean {
		return this.handle.isClosed
	}

	private constructor(handle: BinarySmlFileHandle, chunkSize: number) {
		if (chunkSize < 32) { throw new RangeError("Chunk size too small") }
		this.handle = handle

		this.position = handle.preambleSize
		this.buffer = new Uint8Array(chunkSize)

		this.reader = new Uint8ArrayReader(new Uint8Array(), 0)

		this.root = new SmlElement("Root")
	}

	static async create(filePath: string, chunkSize: number = 4096): Promise<BinarySmlStreamReader> {
		const handle = await BinarySmlFileHandle.createReader(filePath)
		try {
			const reader = new BinarySmlStreamReader(handle, chunkSize)
			await reader.readHead()
			return reader
		} catch(error) {
			await handle.close()
			throw error
		}
	}

	static async getAppendReader(writer: BinarySmlStreamWriter, chunkSize: number = 4096): Promise<BinarySmlStreamReader> {
		if (!writer.existing) { throw new Error(`Writer is not in append mode`) }
		const reader = new BinarySmlStreamReader(writer.handle, chunkSize)
		await reader.readHead()			
		return reader
	}

	private async readHead() {
		const numBytesRead: number = await this.handle.readBytes(this.buffer, 0, this.buffer.length, this.position)
		if (numBytesRead === 0) { throw new InvalidBinarySmlError() }
		const partialBuffer = this.buffer.subarray(0, numBytesRead)
		this.reader.reset(partialBuffer, 0)
		this.root.name = this.reader.readRootElementStart()
		this.position += numBytesRead
		this.rest = partialBuffer.slice(this.reader.offset)
	}
	
	private async readNodeBuffer(): Promise<Uint8Array | null> {
		if (this.rest === null) { return null }

		let lastStartIndex: number = 0
		let current: Uint8Array = this.rest
		for (;;) {
			const endIndex = BinarySmlDecoder.internalGetNodeEndIndex(current, lastStartIndex)

			if (endIndex >= 0) {
				const nodeBytes: Uint8Array = current.subarray(0, endIndex+1)
				this.rest = current.subarray(endIndex+1)
				return nodeBytes
			} else {
				lastStartIndex = current.length
				const numBytesRead: number = await this.handle.readBytes(this.buffer, 0, this.buffer.length, this.position)
				if (numBytesRead === 0) {
					this.rest = null
					if (current.length === 0) { return null }
					return current
				}
				this.position += numBytesRead

				const newCurrent: Uint8Array = new Uint8Array(current.length + numBytesRead)
				newCurrent.set(current, 0)
				if (numBytesRead < this.buffer.length) {
					newCurrent.set(this.buffer.subarray(0, numBytesRead), current.length)
				} else {
					newCurrent.set(this.buffer, current.length)
				}
				current = newCurrent
			}
		}
	}

	async readNode(): Promise<SmlNode | null> {
		if (this.handle.isClosed) { throw new Error("Stream reader is closed") }

		const nodeBuffer = await this.readNodeBuffer()
		if (nodeBuffer === null) { return null }
		this.reader.reset(nodeBuffer, 0)
		const result = BinarySmlDecoder.internalDecodeNode(this.reader)
		if (this.reader.hasBytes) { throw new InvalidBinarySmlError() }
		return result
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