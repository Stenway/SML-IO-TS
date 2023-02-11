import { ReliableTxtFileHandle, SyncReliableTxtFileHandle, WriterMode } from "@stenway/reliabletxt-io";
import { ReliableTxtEncoding } from "@stenway/reliabletxt";
import { SmlDocument, SmlElement, SmlEmptyNode, SmlNode, SyncWsvLineIterator, WsvLineIterator } from "@stenway/sml";
import { SyncWsvStreamReader, WsvStreamReader } from "@stenway/wsv-io";
import { WsvLine } from "@stenway/wsv";
export declare abstract class SmlFile {
    static loadSync(filePath: string, preserveWhitespacesAndComments?: boolean): SmlDocument;
    static load(filePath: string, preserveWhitespacesAndComments?: boolean): Promise<SmlDocument>;
    static saveSync(document: SmlDocument, filePath: string, preserveWhitespacesAndComments?: boolean): void;
    static save(document: SmlDocument, filePath: string, preserveWhitespacesAndComments?: boolean): Promise<void>;
    static appendNodesSync(nodes: SmlNode[], templateDocument: SmlDocument, filePath: string, preserveWhitespacesAndComments?: boolean): void;
    static appendNodes(nodes: SmlNode[], templateDocument: SmlDocument, filePath: string, preserveWhitespacesAndComments?: boolean): Promise<void>;
}
export declare class SyncWsvStreamLineIterator implements SyncWsvLineIterator {
    private reader;
    private currentLine;
    private endKeyword;
    private index;
    private constructor();
    static create(reader: SyncWsvStreamReader, endKeyword: string | null): SyncWsvStreamLineIterator;
    getEndKeyword(): string | null;
    hasLine(): boolean;
    isEmptyLine(): boolean;
    getLine(): WsvLine;
    getLineAsArray(): (string | null)[];
    toString(): string;
    getLineIndex(): number;
}
export declare class WsvStreamLineIterator implements WsvLineIterator {
    private reader;
    private currentLine;
    private endKeyword;
    private index;
    private constructor();
    static create(reader: WsvStreamReader, endKeyword: string | null): Promise<WsvStreamLineIterator>;
    getEndKeyword(): string | null;
    hasLine(): Promise<boolean>;
    isEmptyLine(): Promise<boolean>;
    getLine(): Promise<WsvLine>;
    getLineAsArray(): Promise<(string | null)[]>;
    toString(): string;
    getLineIndex(): number;
}
export declare class SyncSmlStreamReader {
    readonly root: SmlElement;
    private reader;
    private endReached;
    readonly endKeyword: string | null;
    private iterator;
    private preserveWhitespacesAndComments;
    private isAppendReader;
    readonly emptyNodesBefore: SmlEmptyNode[];
    get encoding(): ReliableTxtEncoding;
    get isClosed(): boolean;
    get handle(): SyncReliableTxtFileHandle;
    private constructor();
    static create(filePath: string, preserveWhitespacesAndComments?: boolean, chunkSize?: number): SyncSmlStreamReader;
    static getAppendReader(writer: SyncSmlStreamWriter, preserveWhitespacesAndComments?: boolean, chunkSize?: number): SyncSmlStreamReader;
    readNode(): SmlNode | null;
    close(): void;
}
export declare class SmlStreamReader {
    readonly root: SmlElement;
    private reader;
    private endReached;
    readonly endKeyword: string | null;
    private iterator;
    private preserveWhitespacesAndComments;
    private isAppendReader;
    readonly emptyNodesBefore: SmlEmptyNode[];
    get encoding(): ReliableTxtEncoding;
    get isClosed(): boolean;
    get handle(): ReliableTxtFileHandle;
    private constructor();
    static create(filePath: string, preserveWhitespacesAndComments?: boolean, chunkSize?: number): Promise<SmlStreamReader>;
    static getAppendReader(writer: SmlStreamWriter, preserveWhitespacesAndComments?: boolean, chunkSize?: number): Promise<SmlStreamReader>;
    readNode(): Promise<SmlNode | null>;
    close(): Promise<void>;
}
export declare class SyncSmlStreamWriter {
    private writer;
    readonly endKeyword: string | null;
    private defaultIndentation;
    private preserveWhitespacesAndComments;
    get encoding(): ReliableTxtEncoding;
    get isClosed(): boolean;
    get handle(): SyncReliableTxtFileHandle;
    get existing(): boolean;
    private constructor();
    static create(templateDocument: SmlDocument, filePath: string, mode?: WriterMode, preserveWhitespacesAndComment?: boolean): SyncSmlStreamWriter;
    writeNode(node: SmlNode): void;
    writeNodes(nodes: SmlNode[]): void;
    close(): void;
}
export declare class SmlStreamWriter {
    private writer;
    readonly endKeyword: string | null;
    private defaultIndentation;
    private preserveWhitespacesAndComments;
    get encoding(): ReliableTxtEncoding;
    get isClosed(): boolean;
    get handle(): ReliableTxtFileHandle;
    get existing(): boolean;
    private constructor();
    static create(templateDocument: SmlDocument, filePath: string, mode?: WriterMode, preserveWhitespacesAndComment?: boolean): Promise<SmlStreamWriter>;
    writeNode(node: SmlNode): Promise<void>;
    writeNodes(nodes: SmlNode[]): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=sml-io.d.ts.map