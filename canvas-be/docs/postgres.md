# 1. How to Install Postgres in Linux

1. Update the package first
    ``` bash
    sudo apt update
    ```

2. Install PostgreSQL
    ``` bash
    sudo apt install postgresql postgresql-contrib
    ```

3. Start the PostgreSQL service
    ``` bash
    sudo systemctl start postgresql.service
    ```

4. Verify that PostgreSQL is running
    ``` bash
    sudo systemctl status postgresql
    ```

# 2. How to Access Postgres Database
1. Switch to the postgres user
    ``` bash
    sudo -i -u postgres
    ```

2. Access the PostgreSQL prompt
    ``` bash
    psql
    ```

3. To exit the PostgreSQL prompt, type
    ``` bash
    \q
    ```

# 3. How to Create a New Database in Postgres
1. Access the PostgreSQL prompt
    ``` bash
    psql -U postgres
    ```
2. Create a new database
    ``` POSTGRESQL
    CREATE DATABASE gap_canvas_db;
    ```
3. Verify the database creation
    ``` bash
    \l
    ```

    Output:

    ``` text
                                List of databases
    Name    |  Owner   | Encoding | Collate |  Ctype  |   Access privileges   
    -----------+----------+----------+---------+---------+-----------------------
    gap_canvas_db | postgres | UTF8     | C.UTF-8 | C.UTF-8 | 
    postgres  | postgres | UTF8     | C.UTF-8 | C.UTF-8 | 
    template0 | postgres | UTF8     | C.UTF-8 | C.UTF-8 | =c/postgres          +
              |          |          |         |         | postgres=CTc/postgres
    template1 | postgres | UTF8     | C.UTF-8 | C.UTF-8 | =c/postgres          +
              |          |          |         |         | postgres=CTc/postgres
    (4 rows)
    ```

4. Exit the PostgreSQL prompt
    ``` bash
    \q
    ```

# 4. Create uuid extension in Postgres
1. Access the PostgreSQL prompt
    ``` bash
    psql -U postgres -d gap_canvas_db
    ```
2. Create the uuid extension
    ``` POSTGRESQL
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    ```
3. Verify the extension creation
    ``` bash
    \dx
    ```
    Output:
    ``` text
                                List of installed extensions
    Name    | Version |   Schema   |                   Description                   
    -----------+---------+------------+-------------------------------------------------
    plpgsql   | 1.0     | pg_catalog | PL/pgSQL procedural language
    uuid-ossp | 1.1     | public     | generate universally unique identifiers (UUIDs)
    (2 rows)
    ```

4. Exit the PostgreSQL prompt
    ``` bash
    \q
    ```

# 5. How to Create tables in Postgres
1. Access the PostgreSQL prompt
    ``` bash
    psql -U postgres -d gap_canvas_db
2. Create a `canvas` table
    ```POSTGRESQL
    CREATE TABLE canvas (
        canvas_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        assistant_id TEXT,
        thread_id TEXT UNIQUE,
        file_ids TEXT[] NOT NULL DEFAULT '{}',
        conversation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    ```
3. Create a `canvas_fields` table
    ``` POSTGRESQL
    CREATE TABLE canvas_fields (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        canvas_id UUID NOT NULL UNIQUE REFERENCES canvas(canvas_id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        problem_statement TEXT,
        objectives TEXT[] NOT NULL DEFAULT '{}',
        kpis TEXT[] NOT NULL DEFAULT '{}',
        success_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
        key_features TEXT[] NOT NULL DEFAULT '{}',
        relevant_facts TEXT,
        risks TEXT[] NOT NULL DEFAULT '{}',
        assumptions TEXT[] NOT NULL DEFAULT '{}',
        non_functional_requirements TEXT,
        use_cases TEXT[] NOT NULL DEFAULT '{}',
        governance JSONB NOT NULL DEFAULT '[]'::jsonb,
        tags TEXT[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    ```
4. Create an `update_timestamp` function
    ``` POSTGRESQL
    CREATE OR REPLACE FUNCTION update_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    ```
5. Create triggers to update the `update_canvas_timestamp` field on row modification
    ``` POSTGRESQL
    CREATE TRIGGER update_canvas_timestamp
    BEFORE UPDATE ON canvas
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
    ```
6. Create triggers to update the `update_canvas_fields_timestamp` field on row modification
    ``` POSTGRESQL
    CREATE TRIGGER update_canvas_fields_timestamp
    BEFORE UPDATE ON canvas_fields
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
    ```
7. Verify the table creation
    ``` bash
    \dt
    ```
    Output:
    ``` text
                List of relations
    Schema |     Name      | Type  |  Owner   
    --------+---------------+-------+----------
    public | canvas        | table | postgres
    public | canvas_fields | table | postgres
    (2 rows)
    ```

8. Check table schema
    ``` bash
    \d+ canvas
    ```
    Output:
    ``` text
                                        Table "public.canvas"
     Column      |           Type           | Collation | Nullable |               Default                | Storage  | Stats target | Description 
    --------------+--------------------------+-----------+----------+-------------------------------------+----------+--------------+-------------
     canvas_id    | uuid                     |           | not null | uuid_generate_v4()                  | plain    |              | 
     name         | text                     |           | not null |                                     | extended |              | 
     status       | character varying(50)    |           | not null | 'draft'::character varying          | extended |              | 
     assistant_id | text                     |           |          |                                     | extended |              | 
     thread_id    | text                     |           |          |                                     | extended |              | 
     file_ids     | text[]                   |           | not null | '{}'::text[]                        | extended |              | 
     conversation_metadata | jsonb            |           | not null | '{}'::jsonb                         | extended |              | 
     created_at   | timestamp with time zone |           | not null | now()                               | plain    |              | 
     updated_at   | timestamp with time zone |           | not null | now()                               | plain    |              | 
    Indexes:
        "canvas_pkey" PRIMARY KEY, btree (canvas_id)
        "canvas_thread_id_key" UNIQUE CONSTRAINT, btree (thread_id)
    ```
9. Exit the PostgreSQL prompt
    ``` bash
    \q
    ```