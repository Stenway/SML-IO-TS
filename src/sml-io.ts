/* (C) Stefan John / Stenway / SimpleML.com / 2023 */

import { ReliableTxtFile, ReliableTxtFileHandle, ReliableTxtStreamWriter, ReverseLineIterator, SyncReliableTxtFileHandle, SyncReliableTxtStreamWriter, SyncReverseLineIterator, WriterMode } from "@stenway/reliabletxt-io"
import { ReliableTxtDocument, ReliableTxtEncoding } from "@stenway/reliabletxt"
import { SmlDocument, SmlElement, SmlEmptyNode, SmlNode, SmlParser, SmlParserError, SyncWsvLineIterator, WsvLineIterator } from "@stenway/sml"
import { SyncWsvStreamReader, WsvStreamReader } from "@stenway/wsv-io"
import { WsvLine, WsvValue } from "@stenway/wsv"

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