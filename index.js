const PouchDB = orDefault(require("pouchdb"));
PouchDB.plugin(orDefault(require("pouchdb-adapter-leveldb-browser")));
PouchDB.plugin(orDefault(require("pouchdb-find")));

const AUTHOR_KEY = "author";
const REGEX_NON_WORDS = /\W+/;
const DEFAULT_SORT = [{ type: "desc" }, { createdAt: "desc" }];

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
    await this.createIndex("type");

    await this.createIndex("type", "createdAt");

    await this.createIndex("type", "createdAt", "textSearch");

    await this.createIndex("type", "createdAt", "allPoints");
  }

  async createIndex(...fields) {
    return this.db.createIndex({
      index: { fields },
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

  async addMessage(
    { _id, _rev, revisionOf, focus, main, createdAt = new Date(), points = {} },
    pointStore = {}
  ) {
    const { authorURL } = this;
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

    const allPoints = new Set();

    if (focus) allPoints.add(focus);

    for (const shape in points) {
      const pointIds = points[shape];
      for (const pointId of pointIds) {
        const point = pointStore[pointId];
        if (!point) {
          const error = new Error("Point ID not found in store");
          error.pointId = pointId;
          throw error;
        }
        if (!point._id) throw new Error("Must specify point ID");
        if (!point._rev) {
          await this.addPoint({ createdAt: createdAtTime, ...point });
        }
        allPoints.add(pointId);
        if (point.referenceHistory) {
          for (const { pointId: referencePoint } of point.referenceHistory) {
            allPoints.add(referencePoint);
          }
        }
      }
    }

    const toSave = {
      type: "message",
      revisionOf,
      focus,
      main,
      createdAt: createdAtTime,
      author: authorURL,
      points,
      allPoints: [...allPoints],
    };

    if (_id && _rev) {
      await this.db.put({ ...toSave, _id, _rev });
      return _id;
    } else {
      const { id } = await this.db.post(toSave);

      return id;
    }
  }

  async getMessage(id) {
    const rawMessage = await this.db.get(id);
    const { createdAt } = rawMessage;
    const createdAtDate = new Date(createdAt);

    return { ...rawMessage, createdAt: createdAtDate };
  }

  async searchMessages(
    selector = {},
    { limit = 32, skip, sort = DEFAULT_SORT } = {}
  ) {
    const finalSelector = {
      createdAt: { $exists: true },
      ...selector,
      type: "message",
    };

    const result = await this.db.find({
      selector: finalSelector,
      sort,
      limit,
      skip,
    });

    const { docs } = result;

    return docs.map((rawMessage) => {
      const createdAtDate = new Date(rawMessage.createdAt);
      return { ...rawMessage, createdAt: createdAtDate };
    });
  }

  async getPointsForMessage({ focus, points }) {
    const allPoints = new Set();

    if (focus) allPoints.add(focus);

    for (const shape in points) {
      const pointIds = points[shape];
      for (const pointId of pointIds) {
        allPoints.add(pointId);
      }
    }

    const pointIds = [...allPoints];

    const pointData = await Promise.all(
      pointIds.map((id) => this.getPoint(id))
    );

    return pointData.reduce((result, point) => {
      result[point._id] = point;
      return result;
    }, {});
  }

  async searchPointsByContent(
    query,
    { limit = 32, skip, sort = DEFAULT_SORT } = {}
  ) {
    const tokens = stringToTokens(query);
    const { docs } = await this.db.find({
      selector: {
        type: "point",
        textSearch: { $all: tokens },
        createdAt: { $exists: true },
      },
      sort,
      limit,
      skip,
    });

    return docs;
  }

  async addPoint(point) {
    let textSearch;
    const { _id, content, createdAt } = point;

    // Only set the textSearch property if there's content for this point
    if (content) {
      const tokens = stringToTokens(content);
      if (tokens.length) textSearch = tokens;
    }

    const doc = {
      ...point,
      _id,
      type: "point",
      content,
      createdAt: createdAt || Date.now(),
      textSearch,
    };

    if (!_id) {
      const { id } = await this.db.post(doc);
      return id;
    } else {
      await this.db.put(doc);
      return _id;
    }
  }

  // TODO: Throw error if document isn't a point?
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

// Convert some text to tokens which can be used for searching
function stringToTokens(content) {
  const lowered = content.toLowerCase();
  const rawTokens = lowered.split(REGEX_NON_WORDS);
  const nonEmpty = rawTokens.filter((item) => !!item);
  const deduped = new Set(nonEmpty);
  return [...deduped];
}
