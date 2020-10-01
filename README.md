# ushin-db
The database for storing USHIN data / querying across the p2p network

## Sorting

When you search for either messages or points, the results will be sorted by their createdAt timestamp with newer items showing up first.

This helps show you more recently authored content first and improves the database efficiency by downloading more recent data using the index.

## Full text search and indexing

You can search points by their contents with `db.searchPointsByContent()`.

This works by taking all the words within the content, deduplicating them, and putting them in a `textSearch` array.

When you search, we split up your words and find all points that contain that set of words.

Generally when searching you'll want to use words that are likely to only appear in the points you wish to find.
