/**
* Generated by MongoDB Relational Migrator
* https://www.mongodb.com/products/relational-migrator
* Collection: lodges
* Language: JavaScript
* Template: Node
* Generated on 2025-06-25
*/
export const find = (database, filter) => {
    return database.collection("lodges").find(filter);
}

export const findOne = (database, filter) => {
    return database.collection("lodges").findOne(filter);
}

export const deleteOne = (database, filter) => {
    return database.collection("lodges").deleteOne(filter);
}

export const insertOne = (database, filter) => {
    return database.collection("lodges").insertOne(filter);
}

export const updateOne = (database, filter, updateDoc) => {
    return database.collection("lodges").updateOne(filter, updateDoc);
}