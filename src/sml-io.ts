/* (C) Stefan John / Stenway / SimpleML.com / 2023 */

import * as fs from 'fs'
import { ReliableTxtFile, ReliableTxtStreamWriter, ReverseLineIterator, SyncReliableTxtStreamWriter, SyncReverseLineIterator } from "@stenway/reliabletxt-io"
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
		const writer = new SyncSmlStreamWriter(templateDocument, filePath, preserveWhitespacesAndComments, true)
		try {
			for (const node of nodes) {
				writer.writeNode(node)
			}
		} finally {
			writer.close()
		}
	}

	static async appendNodes(nodes: SmlNode[], templateDocument: SmlDocument, filePath: string, preserveWhitespacesAndComments: boolean = true) {
		if (nodes.length === 0) { return }
		const writer = await SmlStreamWriter.create(templateDocument, filePath, preserveWhitespacesAndComments, true)
		try {
			for (const node of nodes) {
				await writer.writeNode(node)
			}
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

	constructor(reader: SyncWsvStreamReader, endKeyword: string | null) {
		this.reader = reader
		this.endKeyword = endKeyword
		this.currentLine = reader.readLine()
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
	readonly endKeyword: string | null
	private iterator: SyncWsvStreamLineIterator
	private preserveWhitespacesAndComments: boolean
	
	readonly emptyNodesBefore: SmlEmptyNode[] = []

	get encoding(): ReliableTxtEncoding {
		return this.reader.encoding
	}

	get isClosed(): boolean {
		return this.reader.isClosed
	}

	get handle(): number | null {
		return this.reader.handle
	}
	
	constructor(filePath: string, preserveWhitespacesAndComments: boolean = true, chunkSize: number = 4096) {
		this.reader = new SyncWsvStreamReader(filePath, preserveWhitespacesAndComments, chunkSize)
		try {
			this.preserveWhitespacesAndComments = preserveWhitespacesAndComments
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const result = SmlEndKeywordDetector.getEndKeywordAndPositionSync(this.reader.handle!, this.encoding)
			this.endKeyword = result[0]
			
			this.iterator = new SyncWsvStreamLineIterator(this.reader, this.endKeyword)
			
			this.root = SmlParser.readRootElementSync(this.iterator, this.emptyNodesBefore)
			if (!preserveWhitespacesAndComments) { this.emptyNodesBefore = [] }
		} catch (error) {
			this.reader.close()
			throw error
		}
	}
	
	readNode(): SmlNode | null {
		if (!this.preserveWhitespacesAndComments) {
			for (;;) {
				const result = SmlParser.readNodeSync(this.iterator, this.root)
				if (result instanceof SmlEmptyNode) { continue }
				return result
			}
		} else {
			return SmlParser.readNodeSync(this.iterator, this.root)
		}
	}

	close() {
		this.reader.close()
	}
}

// ----------------------------------------------------------------------

export class SmlStreamReader {
	readonly root: SmlElement

	private reader: WsvStreamReader
	readonly endKeyword: string | null
	private iterator: WsvStreamLineIterator
	private preserveWhitespacesAndComments: boolean
	
	readonly emptyNodesBefore: SmlEmptyNode[]

	get encoding(): ReliableTxtEncoding {
		return this.reader.encoding
	}

	get isClosed(): boolean {
		return this.reader.isClosed
	}

	get handle(): fs.promises.FileHandle | null {
		return this.reader.handle
	}

	private constructor(reader: WsvStreamReader, root: SmlElement, endKeyword: string | null, iterator: WsvStreamLineIterator, preserveWhitespacesAndComments: boolean, emptyNodesBefore: SmlEmptyNode[]) {
		this.reader = reader
		this.root = root
		this.endKeyword = endKeyword
		this.iterator = iterator
		this.preserveWhitespacesAndComments = preserveWhitespacesAndComments
		if (!preserveWhitespacesAndComments) { emptyNodesBefore = [] }
		this.emptyNodesBefore = emptyNodesBefore
	}
	
	static async create(filePath: string, preserveWhitespacesAndComments: boolean = true, chunkSize: number = 4096): Promise<SmlStreamReader> {
		const reader = await WsvStreamReader.create(filePath, preserveWhitespacesAndComments, chunkSize)
		try {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const result = await SmlEndKeywordDetector.getEndKeywordAndPosition(reader.handle!, reader.encoding)
			const endKeyword = result[0]
			
			const iterator = await WsvStreamLineIterator.create(reader, endKeyword)
			
			const emptyNodesBefore: SmlEmptyNode[] = []
			const root = await SmlParser.readRootElement(iterator, emptyNodesBefore)
			return new SmlStreamReader(reader, root, endKeyword, iterator, preserveWhitespacesAndComments, emptyNodesBefore)
		} catch (error) {
			reader.close()
			throw error
		}
	}
	
	async readNode(): Promise<SmlNode | null> {
		if (!this.preserveWhitespacesAndComments) {
			for (;;) {
				const result = await SmlParser.readNode(this.iterator, this.root)
				if (result instanceof SmlEmptyNode) { continue }
				return result
			}
		} else {
			return await SmlParser.readNode(this.iterator, this.root)
		}
	}

	async close() {
		await this.reader.close()
	}
}

// ----------------------------------------------------------------------

abstract class SmlEndKeywordDetector {
	static getEndKeywordAndPositionSync(handle: number, encoding: ReliableTxtEncoding): [string | null, number] {
		try {
			let endKeyword: string | null
			const iterator: SyncReverseLineIterator = new SyncReverseLineIterator(handle, encoding)
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

	static async getEndKeywordAndPosition(handle: fs.promises.FileHandle, encoding: ReliableTxtEncoding): Promise<[string | null, number]> {
		try {
			let endKeyword: string | null
			const iterator: ReverseLineIterator = await ReverseLineIterator.create(handle, encoding)
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
	private endKeyword: string | null
	private defaultIndentation: string | null
	private preserveWhitespacesAndComments: boolean
	
	get encoding(): ReliableTxtEncoding {
		return this.writer.encoding
	}

	get isClosed(): boolean {
		return this.writer.isClosed
	}

	get handle(): number | null {
		return this.writer.handle
	}

	get isAppendMode(): boolean {
		return this.writer.isAppendMode
	}

	constructor(templateDocument: SmlDocument, filePath: string, preserveWhitespacesAndComment: boolean = true, append: boolean = false) {
		this.writer = new SyncReliableTxtStreamWriter(filePath, templateDocument.encoding, append)
		try {
			this.preserveWhitespacesAndComments = preserveWhitespacesAndComment
			this.defaultIndentation = templateDocument.defaultIndentation

			if (this.writer.isAppendMode) {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				const handle = this.writer.handle!
				const result = SmlEndKeywordDetector.getEndKeywordAndPositionSync(handle, this.encoding)
				this.endKeyword = result[0]
				const restLength = result[1]
				this.writer.internalTruncate(restLength)
			} else {
				this.endKeyword = templateDocument.endKeyword
				const rootElementName: string = templateDocument.root.name
				this.writer.writeLine(WsvValue.serialize(rootElementName))
			}
		} catch (error) {
			this.writer.close()
			throw error
		}
	}
	
	writeNode(node: SmlNode) {
		const lines: string[] = []
		node.internalSerialize(lines, 1, this.defaultIndentation, this.endKeyword, this.preserveWhitespacesAndComments)
		this.writer.writeLines(lines)
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
	private endKeyword: string | null
	private defaultIndentation: string | null
	private preserveWhitespacesAndComments: boolean
	
	get encoding(): ReliableTxtEncoding {
		return this.writer.encoding
	}

	get isClosed(): boolean {
		return this.writer.isClosed
	}

	get handle(): fs.promises.FileHandle | null {
		return this.writer.handle
	}

	get isAppendMode(): boolean {
		return this.writer.isAppendMode
	}

	private constructor(writer: ReliableTxtStreamWriter, defaultIndentation: string | null, preserveWhitespacesAndComment: boolean, endKeyword: string | null) {
		this.writer = writer
		this.defaultIndentation = defaultIndentation
		this.preserveWhitespacesAndComments = preserveWhitespacesAndComment
		this.endKeyword = endKeyword
	}

	static async create(templateDocument: SmlDocument, filePath: string, preserveWhitespacesAndComment: boolean = true, append: boolean = false) {
		const writer = await ReliableTxtStreamWriter.create(filePath, templateDocument.encoding, append)
		let endKeyword: string | null
		try {
			if (writer.isAppendMode) {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				const handle = writer.handle!
				const result = await SmlEndKeywordDetector.getEndKeywordAndPosition(handle, writer.encoding)
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

	async close() {
		if (!this.writer.isClosed) {	
			await this.writer.writeLine(WsvValue.serialize(this.endKeyword))
			await this.writer.close()
		}
	}
}