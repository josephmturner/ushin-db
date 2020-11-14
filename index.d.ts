declare module 'ushin-db' {
	export interface UshinBaseConstructorOptions {
    leveldown: any;
    authorURL: string
	}

	export interface AuthorInfo {
    name: string,
	}

  // TODO import interface from USHIN here
	export type Message = any
	export type Point = any
	export interface PointStore {
    [_id: string]: Point
	}

	export type ID = string

	export interface SearchLimits {
    limit?:number,
    skip?:number,
    sort?: number
	}

  export declare class USHINBase {
    constructor(options: UshinBaseConstructorOptions)
    init() : Promise<undefined>
    createIndex(...fields: string[]) : Promise<undefined>
    setAuthorInfo(info: AuthorInfo) : Promise<undefined>
    getAuthorInfo() : Promise<AuthorInfo>
    addMessage(message: Message, points: PointStore) : Promise<ID>
    getMessage(id: ID) : Promise<Message>
    searchMessages(selector: any, searchLimits: SearchLimits) : Promise<Message[]>
    getPointsForMessage(message: Message) : Promise<PointStore>
    searchPointsByContent(query: string, searchLimits: SearchLimits) : Promise<Point[]>
    addPoint(point: Point) : Promise<ID>
    getPoint(id: ID) : Promise<Point>
    close() : Promise<undefined>
  }
}
