-- Init schema for gap_canvas_db
-- This script is intended to run on FIRST initialization of the postgres data directory
-- when mounted into /docker-entrypoint-initdb.d (official postgres image behavior).

-- Enable uuid-ossp extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create canvas table to store canvas metadata
CREATE TABLE IF NOT EXISTS public.canvas (
  canvas_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),        -- Unique identifier for each canvas
  name TEXT NOT NULL,                                           -- Name of the canvas
  status VARCHAR(50) NOT NULL DEFAULT 'created',                -- Status of the canvas (e.g., draft, completed)
  assistant_id TEXT,                                            -- Identifier for the Azure assistant associated with the canvas
  thread_id TEXT UNIQUE,                                        -- Unique Azure thread identifier for conversation
  file_ids TEXT[] NOT NULL DEFAULT '{}',                        -- Array of associated file identifiers uploaded in Azure thread for this canvas
  conversation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,     -- Metadata about the conversation stored as JSON
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                -- Timestamp when the canvas was created
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                 -- Timestamp when the canvas was last updated
);

-- Create canvas_fields table to store detailed fields for each canvas
CREATE TABLE IF NOT EXISTS public.canvas_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),               -- Unique identifier for each record
  canvas_id UUID NOT NULL UNIQUE REFERENCES public.canvas(canvas_id) ON DELETE CASCADE, -- Foreign key referencing canvas table
  title TEXT NOT NULL,                                          -- Title of the canvas
  manual_update BOOLEAN NOT NULL DEFAULT FALSE,                 -- Indicates if the canvas was manually updated
  problem_statement TEXT NOT NULL DEFAULT '',                   -- Problem statement for the canvas
  objectives TEXT[] NOT NULL DEFAULT '{}',                      -- Array of objectives for the canvas
  kpis TEXT[] NOT NULL DEFAULT '{}',                            -- Array of key performance indicators
  success_criteria TEXT[] NOT NULL DEFAULT '{}',                -- Success criteria array
  key_features TEXT[] NOT NULL DEFAULT '{}',                    -- Array of key features
  relevant_facts TEXT[] NOT NULL DEFAULT '{}',                  -- Relevant facts for the canvas
  risks TEXT[] NOT NULL DEFAULT '{}',                           -- Array of identified risks
  assumptions TEXT[] NOT NULL DEFAULT '{}',                     -- Array of assumptions made
  non_functional_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,-- Non-functional requirements
  use_cases TEXT[] NOT NULL DEFAULT '{}',                       -- Array of use cases
  governance JSONB NOT NULL DEFAULT '[]'::jsonb,                -- Governance details stored as JSON array
  tags TEXT[] NOT NULL DEFAULT '{}',                            -- Array of tags associated with the canvas
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                -- Timestamp when the record was created
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                 -- Timestamp when the record was last updated
);

-- Create function to update the updated_at timestamp on record modification
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$       -- Trigger function to update updated_at timestamp
BEGIN                       -- On update, set updated_at to current timestamp
  NEW.updated_at = NOW();   -- Update the updated_at field
  RETURN NEW;               -- Return the modified record
END;                        -- End of function
$$ LANGUAGE plpgsql;        -- Use PL/pgSQL language for the function

-- Create triggers to automatically update updated_at on record updates
DO $$
BEGIN                                                             -- Anonymous code block to create triggers if they don't exist
  IF NOT EXISTS (                                                 -- Check if trigger for canvas table exists
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_canvas_timestamp' -- Trigger name
  ) THEN                                                          -- If not exists, create the trigger for canvas table
    CREATE TRIGGER update_canvas_timestamp                        -- Trigger name
    BEFORE UPDATE ON public.canvas                                -- On update of canvas table
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();      -- Execute the update_timestamp function
  END IF;                                                         -- End if

  IF NOT EXISTS (                                                 -- Check if trigger for canvas_fields table exists
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_canvas_fields_timestamp' -- Trigger name
  ) THEN                                                          -- If not exists, create the trigger for canvas_fields table
    CREATE TRIGGER update_canvas_fields_timestamp                 -- Trigger name
    BEFORE UPDATE ON public.canvas_fields                         -- On update of canvas_fields table
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();      -- Execute the update_timestamp function
  END IF;                                                         -- End if
END
$$;
-- End of 01_init.sql