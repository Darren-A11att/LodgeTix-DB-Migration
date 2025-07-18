/**
* Generated by MongoDB Relational Migrator
* https://www.mongodb.com/products/relational-migrator
* Collection: attendeeEvents
* Language: JavaScript
* Template: Node
* Generated on 2025-06-25
*/
export const find = (database, filter) => {
    return database.collection("attendeeEvents").find(filter);
}

export const findOne = (database, filter) => {
    return database.collection("attendeeEvents").findOne(filter);
}

export const deleteOne = (database, filter) => {
    return database.collection("attendeeEvents").deleteOne(filter);
}

export const insertOne = (database, filter) => {
    return database.collection("attendeeEvents").insertOne(filter);
}

export const updateOne = (database, filter, updateDoc) => {
    return database.collection("attendeeEvents").updateOne(filter, updateDoc);
}