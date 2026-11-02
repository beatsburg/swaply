-- SWAPLY Database Schema (PostgreSQL)

-- 1. Users & Authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Profiles (Public & Personal info)
CREATE TABLE IF NOT EXISTS profiles (
    user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    avatar_url TEXT DEFAULT NULL,
    about_me TEXT DEFAULT '',
    city VARCHAR(100) DEFAULT '',
    latitude DOUBLE PRECISION DEFAULT NULL,
    longitude DOUBLE PRECISION DEFAULT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. User Bios & Matching Preferences (5+ biographical criteria)
CREATE TABLE IF NOT EXISTS user_bios (
    user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    interests TEXT[] DEFAULT '{}',
    preferred_categories TEXT[] DEFAULT '{}',
    preferred_conditions TEXT[] DEFAULT '{}',
    min_value NUMERIC(10,2) DEFAULT 0,
    max_value NUMERIC(10,2) DEFAULT 1000,
    max_distance_km INT DEFAULT 50,
    weights JSONB DEFAULT '{"category": 3, "value": 2, "distance": 2, "condition": 2, "interests": 1}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Items (Trade items - 1 active item per user)
CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT DEFAULT '',
    category VARCHAR(50) NOT NULL,
    condition VARCHAR(50) NOT NULL,
    estimated_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    image_url TEXT DEFAULT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'reserved', 'swapped', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure only 1 active item per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_single_active_item ON items(user_id) WHERE status = 'active';

-- 5. Active Recommendations (Cache for fast 404 access checking)
CREATE TABLE IF NOT EXISTS active_recommendations (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recommended_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, recommended_user_id)
);

-- 6. Swipes (Item-informed user swipes)
CREATE TABLE IF NOT EXISTS swipes (
    id SERIAL PRIMARY KEY,
    swiper_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    swiper_item_id INT REFERENCES items(id) ON DELETE SET NULL,
    target_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_item_id INT REFERENCES items(id) ON DELETE SET NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('like', 'dismiss')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (swiper_id, target_user_id)
);

-- 7. Connections & Matches
CREATE TABLE IF NOT EXISTS connections (
    id SERIAL PRIMARY KEY,
    user1_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item1_id INT REFERENCES items(id) ON DELETE SET NULL,
    item2_id INT REFERENCES items(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'disconnected')),
    requester_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user1_id, user2_id)
);

-- 8. Conversations & Messages (Real-time Chat)
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    user1_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user1_id, user2_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at DESC);

-- 9. Exchanges (Completed Swaps for history / Swap Journey)
CREATE TABLE IF NOT EXISTS exchanges (
    id SERIAL PRIMARY KEY,
    user1_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item1_id INT REFERENCES items(id) ON DELETE SET NULL,
    item2_id INT REFERENCES items(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

