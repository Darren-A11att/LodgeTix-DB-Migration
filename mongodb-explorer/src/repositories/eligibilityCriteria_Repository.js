/**
* Generated by MongoDB Relational Migrator
* https://www.mongodb.com/products/relational-migrator
* Collection: eligibilityCriteria
* Language: JavaScript
* Template: Node
* Generated on 2025-06-25
*/
export const find = (database, filter) => {
    return database.collection("eligibilityCriteria").find(filter);
}

export const findOne = (database, filter) => {
    return database.collection("eligibilityCriteria").findOne(filter);
}

export const deleteOne = (database, filter) => {
    return database.collection("eligibilityCriteria").deleteOne(filter);
}

export const insertOne = (database, filter) => {
    return database.collection("eligibilityCriteria").insertOne(filter);
}

export const updateOne = (database, filter, updateDoc) => {
    return database.collection("eligibilityCriteria").updateOne(filter, updateDoc);
}