const { USHINBase } = require("./");
const memdown = require("memdown");
const test = require("tape");

async function getNew(authorURL = "hyper://example") {
  const leveldown = (name) => memdown();
  const db = new USHINBase({ leveldown, authorURL });

  await db.init();

  return db;
}

const EXAMPLE_POINT_ID = "Example-Point";

const EXAMPLE_POINT = {
  _id: EXAMPLE_POINT_ID,
  content: "Cats bring me joy",
};

const EXAMPLE_MESSAGE = {
  main: EXAMPLE_POINT_ID,
  points: {
    feelings: [EXAMPLE_POINT_ID],
  },
};

const EXAMPLE_POINT_STORE = {
  [EXAMPLE_POINT_ID]: EXAMPLE_POINT,
};

test("Able to initialize and set author metadata", async (t) => {
  t.plan(3);
  try {
    var db = await getNew();

    t.pass("Able to create the DB");

    await db.setAuthorInfo({ name: "Example" });

    t.pass("Able to set author info");

    const { name } = await db.getAuthorInfo();

    t.equal(name, "Example", "name got set and can be retrieved");
  } catch (e) {
    t.error(e);
  } finally {
    if (db) db.close();
  }
});

test("Able to add and get messages", async (t) => {
  t.plan(8);
  try {
    var db = await getNew("test");

    const id = await db.addMessage(EXAMPLE_MESSAGE, EXAMPLE_POINT_STORE);

    t.pass("Able to add message");

    const message = await db.getMessage(id);

    const { author, points, createdAt, main } = message;
    const { feelings } = points;
    const [pointId] = feelings;

    t.equal(pointId, EXAMPLE_POINT_ID, "Got saved point");

    const pointStore = await db.getPointsForMessage(message);

    const point = pointStore[pointId];

    t.equal(author, "test", "Author got set");
    t.equal(feelings.length, 1, "Feelings got set");

    t.ok(
      createdAt instanceof Date,
      "Timestamp got auto-generated and is a Date"
    );
    t.equal(main, EXAMPLE_MESSAGE.main, "main id got set");

    t.ok(point, "Got point from store");
    t.equal(point.content, "Cats bring me joy", "Point content got set");
  } catch (e) {
    t.error(e);
  } finally {
    if (db) db.close();
  }
});

test("Able to search for messages in a time range", async (t) => {
  t.plan(6);
  try {
    var db = await getNew("test");

    await db.addPoint(EXAMPLE_POINT);

    const point = await db.getPoint(EXAMPLE_POINT_ID);

    const pointStore = { [EXAMPLE_POINT_ID]: point };

    await db.addMessage(
      { createdAt: new Date(10), ...EXAMPLE_MESSAGE },
      pointStore
    );
    await db.addMessage(
      { createdAt: new Date(2000), ...EXAMPLE_MESSAGE },
      pointStore
    );
    await db.addMessage(
      { createdAt: new Date(3000), ...EXAMPLE_MESSAGE },
      pointStore
    );

    t.pass("Able to add several messages");

    const results = await db.searchMessages({ createdAt: { $gt: 100 } });

    t.equal(results.length, 2, "Got expected number of results");

    const [message] = results;
    const { author, points, createdAt } = message;
    const { feelings } = points;
    const [pointId] = feelings;

    t.equal(pointId, EXAMPLE_POINT_ID, "Got point ID");
    t.equal(author, "test", "Author got set");
    t.equal(feelings.length, 1, "Feelings got set");
    t.ok(
      createdAt instanceof Date,
      "Timestamp got auto-generated and is a Date"
    );
  } catch (e) {
    t.error(e);
  } finally {
    if (db) db.close();
  }
});

test("Able to search for messages that contain a point ID", async (t) => {
  t.plan(1);
  try {
    var db = await getNew();

    await db.addMessage(
      { ...EXAMPLE_MESSAGE, focus: EXAMPLE_POINT_ID },
      EXAMPLE_POINT_STORE
    );

    console.log(
      "All messages",
      (await db.db.allDocs({ include_docs: true })).rows.map(({ doc }) => doc)
    );
    console.log(
      "Legit all messages",
      await db.db.find({
        selector: {
          type: { $eq: "message" },
        },
      })
    );

    console.log("From DB", await db.searchMessages());

    const results = await db.searchMessages({ allPoints: EXAMPLE_POINT_ID });

    t.equal(results.length, 1, "Found message in search");
  } catch (e) {
    console.error(e.stack);
    t.error(e);
  } finally {
    if (db) db.close();
  }
});

test.skip("Able to search for points by their text contents", async (t) => {
  try {
    var db = await getNew();

    await db.addPoint({ content: "Hello world", _id: "one" });
    await db.addPoint({ content: "Goodbye world", _id: "two" });

    const results1 = await db.searchPointsByContent("world");
    const results1Ids = results1.map(({ _id }) => _id);

    // Note that the sort order has newer points first
    t.deepEqual(results1Ids, ["two", "one"], "Got expected point IDs");

    const results2 = await db.searchPointsByContent("hello");
    const results2Ids = results2.map(({ _id }) => _id);

    t.deepEqual(results2Ids, ["one"], "Got just the matching document");
  } catch (e) {
    t.error(e);
  } finally {
    if (db) db.close();
    t.end();
  }
});

function makePoint(point = {}) {
  const _id = Date.now() + "";

  return { _id, ...EXAMPLE_POINT, ...point };
}
