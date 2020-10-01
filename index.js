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
      // This is some weird legacy thing we're going to pretend doesn't exist.
      migrate: false,
    });
    this.authorURL = authorURL;
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
    createdAt = new Date(),
    points = {},
  }) {
    const { authorURL } = this;
    const finalPoints = {};
    let createdAtTime;
    if (typeof createdAt === "string") {
      createdAtTime = new Date(createdAt).getTime();
    } else if (typeof createdAt === "object") {
      createdAtTime = createdAt.getTime();
    } else {
      throw new Error(
        "message's createdAt attribute is neither of type string nor object"
      );
    }

    for (const shape in points) {
      const originalPoints = points[shape];
      const pointPromises = originalPoints.map((point) => {
        if (!point._id || !point._rev) {
          return this.addPoint({ createdAt: createdAtTime, ...point });
        }
        return point._id;
      });
      const pointIDs = await Promise.all(pointPromises);
      finalPoints[shape] = pointIDs;
    }

    const { id } = await this.db.post({
      type: "message",
      revisionOf,
      focus,
      main,
      createdAt: createdAtTime,
      author: authorURL,
      points: finalPoints,
    });

    return id;
  }

  async getMessage(id) {
    const rawMessage = await this.db.get(id);

    return this._populateMessage(rawMessage);
  }

  async _populateMessage(rawMessage) {
    const { points: rawPoints, createdAt } = rawMessage;

    const finalPoints = {};

    for (const shape in rawPoints) {
      const pointIDs = rawPoints[shape];
      const pointPromises = pointIDs.map((id) => this.getPoint(id));
      const pointObjects = await Promise.all(pointPromises);
      finalPoints[shape] = pointObjects;
    }

    const createdAtDate = new Date(createdAt);

    return {
      ...rawMessage,
      points: finalPoints,
      createdAt: createdAtDate,
    };
  }

  async searchMessages(selector = {}, { limit = 32, skip, sort } = {}) {
    const finalSelector = { ...selector, type: "message" };
    const { docs } = await this.db.find({
      selector: finalSelector,
      limit,
      skip,
    });

    return Promise.all(docs.map((message) => this._populateMessage(message)));
  }

  async addPoint({
    _id,
    author,
    content,
    shape,
    pointDate,
    quotedAuthor,
    createdAt,
  }) {
    const doc = {
      _id,
      type: "point",
      author,
      content,
      shape,
      pointDate,
      quotedAuthor,
      createdAt,
    };
    if (!_id) {
      const { id } = await this.db.post(doc);
      return id;
    } else {
      await this.db.put(doc);
      return _id;
    }
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
