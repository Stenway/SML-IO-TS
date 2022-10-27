import { ReliableTxtEncoding } from "@stenway/reliabletxt";
import { SmlDocument, SmlElement, SmlEmptyNode, SmlNode, WsvLineIterator } from "@stenway/sml";
import { SyncWsvStreamReader } from "@stenway/wsv-io";
import { WsvLine } from "@stenway/wsv";
export declare abstract class SmlFile {
    static loadSync(filePath: string, preserveWhitespacesAndComments?: boolean): SmlDocument;
    static saveSync(document: SmlDocument, filePath: string, preserveWhitespacesAndComments?: boolean): void;
}
export declare class SyncWsvStreamLineIterator implements WsvLineIterator {
    private reader;
    private currentLine;
    private endKeyword;
    private index;
    constructor(reader: SyncWsvStreamReader, endKeyword: string | null);
    getEndKeyword(): string | null;
    hasLine(): boolean;
    isEmptyLine(): boolean;
    getLine(): WsvLine;
    getLineAsArray(): (string | null)[];
    toString(): string;
    getLineIndex(): number;
}
export declare class SyncSmlStreamReader {
    readonly encoding: ReliableTxtEncoding;
    readonly root: SmlElement;
    private reader;
    private endKeyword;
    private iterator;
    readonly emptyNodesBefore: SmlEmptyNode[];
    constructor(filePath: string, endKeyword?: string | null);
    readNode(): SmlNode | null;
    close(): void;
}
export declare class SyncSmlStreamWriter {
    private writer;
    private endKeyword;
    private defaultIndentation;
    private preserveWhitespacesAndComment;
    get encoding(): ReliableTxtEncoding;
    constructor(templateDocument: SmlDocument, filePath: string, encoding?: ReliableTxtEncoding, preserveWhitespacesAndComment?: boolean, append?: boolean);
    writeNode(node: SmlNode): void;
    close(): void;
}
