const { USHINBase } = require("./");
const memdown = require("memdown");
const test = require("tape");

async function getNew(authorURL = "hyper://example") {
  const leveldown = (name) => memdown();
  const db = new USHINBase({ leveldown, authorURL });

  await db.init();

  return db;
}

const EXAMPLE_MESSAGE = {
  points: {
    feelings: [
      {
        content: "Cats bring me joy",
      },
    ],
  },
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
  t.plan(5);
  try {
    var db = await getNew("test");

    const id = await db.addMessage(EXAMPLE_MESSAGE);

    t.pass("Able to add message");

    const message = await db.getMessage(id);

    const { author, points, createdAt } = message;
    const { feelings } = points;
    const [point] = feelings;
    t.equal(author, "test", "Author got set");
    t.equal(feelings.length, 1, "Feelings got set");
    t.equal(point.content, "Cats bring me joy", "Point content got set");
    t.ok(createdAt, "Timestamp got auto-generated");
  } catch (e) {
    t.error(e);
  } finally {
    if (db) db.close();
  }
});
test("Able to search for messages in a time range", async (t) => {
  t.plan(2);
  try {
    var db = await getNew("test");

    await db.addMessage({ createdAt: new Date(10), ...EXAMPLE_MESSAGE });
    await db.addMessage({ createdAt: new Date(2000), ...EXAMPLE_MESSAGE });
    await db.addMessage({ createdAt: new Date(3000), ...EXAMPLE_MESSAGE });

    t.pass("Able to add several messages");

    const results = await db.searchMessages({ createdAt: { $gt: 100 } });

    t.equal(results.length, 2, "Got expected results");
  } catch (e) {
    t.error(e);
  } finally {
    if (db) db.close();
  }
});
