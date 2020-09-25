const PouchDB = orDefault(require("pouchdb"));
PouchDB.plugin(orDefault(require("pouchdb-adapter-leveldb-browser")));
PouchDB.plugin(orDefault(require("pouchdb-find")));

const AUTHOR_KEY = "author";

// Based on USHIN data model
// https://github.com/USHIN-Inc/ushin-app/blob/master/src/dataModels.ts

class USHINBase {
  constructor({ leveldown, authorURL }) {
    this.leveldown = leveldown;
    this.db = new PouchDB("ushin-db", {
      adapter: "leveldb",
      db: leveldown,
    });
    this.authorURL = authorURL;
    this.loadDBForAuthor;
  }

  async init() {
    // TODO create indexes here based on the sorts of queries we want
    await this.db.createIndex({
      index: {
        fields: ["type"],
      },
    });
    await this.db.createIndex({
      index: {
        fields: ["type", "createdAt"],
      },
    });
  }

  async setAuthorInfo(info = {}) {
    const { _rev, _id, ...data } = this.getAuthorInfo();
    await this.db.put({
      ...data,
      ...info,
      _id: AUTHOR_KEY,
      _rev,
    });
  }

  async getAuthorInfo() {
    try {
      const info = await this.db.get(AUTHOR_KEY);
      return info;
    } catch (e) {
      return { _id: AUTHOR_KEY };
    }
  }

  async addMessage({
    revisionOf,
    focus,
    main,
    points = {},
  }) {
    const { authorURL } = this;
    const finalPoints = {};
    const createdAt = new Date().getTime();

    for (const shape in points) {
      const originalPoints = points[shape];
      const pointPromises = originalPoints.map((point) =>
        this.addPoint({ createdAt: createdAt, ...point })
      );
      const pointIDs = await Promise.all(pointPromises);
      finalPoints[shape] = pointIDs;
    }

    const { id } = await this.db.post({
      type: "message",
      revisionOf,
      focus,
      main,
      createdAt: createdAt,
      author: authorURL,
      points: finalPoints,
    });

    return id;
  }

  async getMessage(id) {
    const rawMessage = await this.db.get(id);
    const { points: rawPoints, createdAt } = rawMessage;

    const finalPoints = {};

    for (let shape in rawPoints) {
      const pointIDs = rawPoints[shape];
      const pointPromises = pointIDs.map((id) => this.getPoint(id));
      const pointObjects = await Promise.all(pointPromises);
      finalPoints[shape] = pointObjects;
    }

    const createdAtDate = new Date(createdAt);

    return {
      ...rawMessage,
      points: finalPoints,
      messageId: id,
      createdAt: createdAtDate,
    };
  }

  async searchMessages(selector = {}, { limit = 32, skip, sort } = {}) {
    const finalSelector = { ...selector, type: "message" };
    const { docs } = await this.db.find({
      finalSelector,
      limit,
      skip,
    });

    return docs;
  }

  async addPoint({
    author,
    content,
    shape,
    pointDate,
    quotedAuthor,
  }) {
    const { id } = await this.db.post({
      type: "point",
      author,
      content,
      shape,
      pointDate,
      quotedAuthor,
    });
    return id;
  }

  async getPoint(id) {
    return this.db.get(id);
  }

  async close() {
    return this.db.close();
  }
}

module.exports = {
  USHINBase,
};

// This is necessary to account for Webpack environments
// Pouch exports ESM when possible, and Webpack doesn't normalize it back
function orDefault(module) {
  if (module.default) return module.default;
  return module;
}
