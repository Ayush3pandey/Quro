from neo4j import GraphDatabase

# Aura Free requires encrypted Bolt with certificate validation
uri = "bolt+ssc://1b52af99.databases.neo4j.io"
auth = ("neo4j", "BIrkFUG0YEWiEYE8uAeNWhjgpvknM3FKTh9fuApDNf4")

driver = GraphDatabase.driver(uri, auth=auth)

with driver.session() as session:
    result = session.run("RETURN 1 AS ok").single()
    print("Connected:", result)