PRAGMA foreign_keys = ON;

CREATE TABLE Users (
    user_id   INTEGER PRIMARY KEY,
    usertype  INTEGER NOT NULL,
    username  VARCHAR NOT NULL,
    email     VARCHAR NOT NULL UNIQUE,
    password  VARCHAR NOT NULL
);

CREATE TABLE Locations (
    location_id INTEGER PRIMARY KEY,
    name        VARCHAR NOT NULL,
    address     VARCHAR,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at  DATETIME
);

CREATE TABLE Categories (
    category_id INTEGER PRIMARY KEY,
    name        VARCHAR NOT NULL,
    description VARCHAR,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at  DATETIME
);

CREATE TABLE Products (
    product_id    INTEGER PRIMARY KEY,
    category_id   INTEGER NOT NULL,
    name          VARCHAR NOT NULL,
    price         INTEGER NOT NULL,
    reorder_level VARCHAR,
    description   TEXT,
    sku           VARCHAR UNIQUE,
    unit          VARCHAR,
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at    DATETIME,
    FOREIGN KEY (category_id) REFERENCES Categories(category_id)
);

CREATE TABLE Orders (
    order_id     INTEGER PRIMARY KEY,
    location_id  INTEGER NOT NULL,
    order_date   DATETIME NOT NULL DEFAULT (datetime('now')),
    status       VARCHAR NOT NULL,
    total_amount DECIMAL NOT NULL,
    FOREIGN KEY (location_id) REFERENCES Locations(location_id)
);

CREATE TABLE Order_Items (
    order_item_id INTEGER PRIMARY KEY,
    order_id      INTEGER NOT NULL,
    product_id    INTEGER NOT NULL,
    quantity      INTEGER NOT NULL,
    price         INTEGER NOT NULL,
    FOREIGN KEY (order_id)   REFERENCES Orders(order_id),
    FOREIGN KEY (product_id) REFERENCES Products(product_id)
);

CREATE TABLE Payments (
    payment_id     INTEGER PRIMARY KEY,
    order_id       INTEGER NOT NULL,
    payment_method VARCHAR NOT NULL,
    quantity       INTEGER NOT NULL,
    price          INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES Orders(order_id)
);

CREATE TABLE Inventory (
    inventory_id INTEGER PRIMARY KEY,
    product_id   INTEGER NOT NULL,
    location_id  INTEGER NOT NULL,
    quantity     INTEGER NOT NULL DEFAULT 0,
    updated_at   DATETIME,
    FOREIGN KEY (product_id)  REFERENCES Products(product_id),
    FOREIGN KEY (location_id) REFERENCES Locations(location_id)
);

CREATE TABLE Stock_Transfers (
    transfer_id      INTEGER PRIMARY KEY,
    from_location_id INTEGER NOT NULL,
    to_location_id   INTEGER NOT NULL,
    user_id          INTEGER NOT NULL,
    quantity         INTEGER NOT NULL,
    transfer_date    DATETIME NOT NULL DEFAULT (datetime('now')),
    status           VARCHAR NOT NULL,
    FOREIGN KEY (from_location_id) REFERENCES Locations(location_id),
    FOREIGN KEY (to_location_id)   REFERENCES Locations(location_id),
    FOREIGN KEY (user_id)          REFERENCES Users(user_id)
);

CREATE TABLE Stock_Adjustments (
    adjustment_id   INTEGER PRIMARY KEY,
    location_id     INTEGER NOT NULL,
    user_id         INTEGER NOT NULL,
    quantity_change INTEGER NOT NULL,
    reason          VARCHAR,
    date            DATETIME NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (location_id) REFERENCES Locations(location_id),
    FOREIGN KEY (user_id)     REFERENCES Users(user_id)
);

CREATE TABLE Activity_Log (
    log_id       INTEGER PRIMARY KEY,
    user_id      INTEGER NOT NULL,
    module       VARCHAR NOT NULL,
    action_type  VARCHAR NOT NULL,
    action       VARCHAR NOT NULL,
    details      TEXT,
    timestamp    DATETIME NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);
