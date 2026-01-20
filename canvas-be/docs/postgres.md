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
    CREATE TABLE IF NOT EXISTS public.canvas (
        canvas_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'created',
        assistant_id TEXT,
        thread_id TEXT UNIQUE,
        file_ids TEXT[] NOT NULL DEFAULT '{}',
        conversation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ```
3. Create a `canvas_fields` table
    ```POSTGRESQL
    CREATE TABLE IF NOT EXISTS public.canvas_fields (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        canvas_id UUID NOT NULL UNIQUE REFERENCES public.canvas(canvas_id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        manual_update BOOLEAN NOT NULL DEFAULT FALSE,
        problem_statement TEXT NOT NULL DEFAULT '',
        objectives TEXT[] NOT NULL DEFAULT '{}',
        kpis TEXT[] NOT NULL DEFAULT '{}',
        success_criteria TEXT[] NOT NULL DEFAULT '{}',
        key_features TEXT[] NOT NULL DEFAULT '{}',
        relevant_facts TEXT[] NOT NULL DEFAULT '{}',
        risks TEXT[] NOT NULL DEFAULT '{}',
        assumptions TEXT[] NOT NULL DEFAULT '{}',
        non_functional_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
        use_cases TEXT[] NOT NULL DEFAULT '{}',
        governance JSONB NOT NULL DEFAULT '[]'::jsonb,
        tags TEXT[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ```
4. Create an `update_timestamp` function
    ```POSTGRESQL
    CREATE OR REPLACE FUNCTION public.update_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    ```
5. Create triggers to update the `updated_at` field on row modification (only if not already present)
    ```POSTGRESQL
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger WHERE tgname = 'update_canvas_timestamp'
        ) THEN
            CREATE TRIGGER update_canvas_timestamp
            BEFORE UPDATE ON public.canvas
            FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger WHERE tgname = 'update_canvas_fields_timestamp'
        ) THEN
            CREATE TRIGGER update_canvas_fields_timestamp
            BEFORE UPDATE ON public.canvas_fields
            FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
        END IF;
    END
    $$;
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
    ```bash
    \d+ canvas
    \d+ canvas_fields
    ```
    Output (example):
    ```text
    Table "public.canvas"
     Column      |           Type           | Collation | Nullable |               Default                
    --------------+--------------------------+-----------+----------+-------------------------------------
     canvas_id    | uuid                     |           | not null | uuid_generate_v4()
     name         | text                     |           | not null | 
     status       | character varying(50)    |           | not null | 'created'::character varying
     assistant_id | text                     |           |          | 
     thread_id    | text                     |           |          | 
     file_ids     | text[]                   |           | not null | '{}'::text[]
     conversation_metadata | jsonb            |           | not null | '{}'::jsonb
     created_at   | timestamp with time zone |           | not null | now()
     updated_at   | timestamp with time zone |           | not null | now()
    Indexes:
        "canvas_pkey" PRIMARY KEY, btree (canvas_id)
        "canvas_thread_id_key" UNIQUE CONSTRAINT, btree (thread_id)

    Table "public.canvas_fields"
     Column      |           Type           | Collation | Nullable |               Default                
    --------------+--------------------------+-----------+----------+-------------------------------------
     id          | uuid                     |           | not null | uuid_generate_v4()
     canvas_id   | uuid                     |           | not null | 
     title       | text                     |           | not null | 
     manual_update | boolean                 |           | not null | false
     problem_statement | text                |           | not null | ''
     objectives  | text[]                   |           | not null | '{}'::text[]
     kpis        | text[]                   |           | not null | '{}'::text[]
     success_criteria | text[]               |           | not null | '{}'::text[]
     key_features | text[]                  |           | not null | '{}'::text[]
     relevant_facts | text[]                 |           | not null | '{}'::text[]
     risks       | text[]                   |           | not null | '{}'::text[]
     assumptions | text[]                   |           | not null | '{}'::text[]
     non_functional_requirements | jsonb     |           | not null | '{}'::jsonb
     use_cases   | text[]                   |           | not null | '{}'::text[]
     governance  | jsonb                    |           | not null | '[]'::jsonb
     tags        | text[]                   |           | not null | '{}'::text[]
     created_at  | timestamp with time zone |           | not null | now()
     updated_at  | timestamp with time zone |           | not null | now()
    Indexes:
        "canvas_fields_pkey" PRIMARY KEY, btree (id)
        "canvas_fields_canvas_id_key" UNIQUE CONSTRAINT, btree (canvas_id)
    ```
9. Exit the PostgreSQL prompt
    ``` bash
    \q
    ```