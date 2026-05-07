# REST API Server Management

Qt CLI provides `server` with three sub-commands to manage REST server.
- [start](#starting-the-server)
- [stop](#stopping-the-server)
- [ls](#listing-running-servers)

```bash
qtcli server <start|stop|ls> [OPTIONS]
```


## Starting the server

```bash
qtcli server start [OPTIONS]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--socket <name>` | - | Specify UDS(Unix Domain Socket) socket name. |
| `--tcp` | false | Use TCP instead of UDS |
| `--port <port>` | 8080 | Specify TCP port (only used with `--tcp`) |
| `--exit-on-idle` | false | Exit the server automatically after inactivity |
| `--heartbeat <duration>` | 10s | Heartbeat interval for idle detection (e.g., `5s`, `1m`) |

#### Examples

```bash
# start server with Unix Domain Socket (default):
$ qtcli server start

# start server with custom socket name
$ qtcli server start --socket my-custom-socket


# start server with TCP on port 8080
$ qtcli server start --tcp --port 8080

# start server with auto-exit on idle
$ qtcli server start --exit-on-idle --heartbeat 5s
```

## Stopping the server

```bash
qtcli server stop [OPTIONS]
```


| Option | Default | Description |
|--------|---------|-------------|
| `--socket <name>` | - | Socket name of UDS server to stop (default: default) |
| `--tcp` | false |Stop the TCP server (same as start) |
| `--port <port>` | 8080 | Port of TCP server to stop (default: 8080) |

**Examples:**

```bash
# stop UDS server
qtcli server stop --socket my-custom-socket

# stop TCP server on port 8080
qtcli server stop --tcp --port 8080

# stop all server instances
qtcli server stop all
```

## Listing running servers

```bash
qtcli server ls
```

---

# REST API Endpoints - V1

There are three types of endpoints:
- [Presets management](#preset-management)
- [Item (project or file) creation](#item-creation)
- [Server management](#server-management)


## Preset management

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/v1/presets` | Retrieve all presets or filter by type/name |
|  | `/v1/presets/:id` | Get details of a specific preset by ID |
| POST | `/v1/presets` | Create a new custom preset |
| PATCH | `/v1/presets/:id` | Update an existing custom preset |
| DELETE | `/v1/presets/:id` | Delete a custom preset |

### GET /presets
Retrieve all presets (filter: `?type=project|file`, `?name=<name>`)
```bash
GET /v1/presets
GET /v1/presets?type=project
GET /v1/presets?name=@projects/cpp/console
```

```json
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Date: Mon, 18 May 2026 14:05:46 GMT
Connection: close
Transfer-Encoding: chunked

[
  {
    "id": "3972419898",
    "name": "@projects/cpp/console",
    "meta": {
      "type": "project",
      "title": "Qt console application",
      "description": "Creates a project containing a single main.cpp file with a stub implementation and no graphical UI."
    }
  },
  ...
]
```

### GET /presets/:id

Get preset details by ID

```bash
GET /v1/presets/2239089261
```
```json
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Date: Mon, 18 May 2026 14:08:39 GMT
Content-Length: 225
Connection: close

{
  "id": "3972419898",
  "name": "@projects/cpp/console",
  "meta": {
    "type": "project",
    "title": "Qt console application",
    "description": "Creates a project containing a single main.cpp file with a stub implementation and no graphical UI."
  }
}
```

### POST /presets

Create a new custom preset

```bash
POST /v1/presets
Content-Type: application/json

{
  "name": "mypreset",
  "presetId": "3399596650",
  "options": {
      "qqcStyle": "Material",
      "qqcTheme": "Dark"
  }
}

```

### PATCH /presets/:id

Update a custom preset

```bash
PATCH /v1/presets/1234567890
Content-Type: application/json

{
  "options": {
    "minimumQtVersion": "6.4",
    "qqcStyle": "Universal"
  }
}

```

### DELETE /presets/:id
Delete a custom preset
```bash
DELETE /v1/presets/1234567890
```



## Item creation

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/v1/items` | Create a new project or file based on a preset |
| | `/v1/items/validate` | Validate item creation parameters |

### POST /items

Create a new project or file based on a preset

```bash
POST /v1/items
Content-Type: application/json

{
    "name": "myapp",
    "workingDir": "/home/my_all_projects",
    "presetId": "3399596650"
}
```

Set `dry_run` to true to run this endpoint without actually creating files.
```bash
POST /v1/items?dry_run=true
Content-Type: application/json

{
    "name": "myapp",
    "workingDir": "/home/my_all_projects",
    "presetId": "3399596650"
}
```

### POST /items/validate
Validate item creation parameters without actually creating
```bash
POST /v1/items/validate
Content-Type: application/json

{
    "name": "myapp",
    "workingDir": "/home/my_all_projects",
    "presetId": "3399596650"
}
```

When validation fails, endpoint returns error with details:

```json
HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8
Date: Mon, 18 May 2026 14:17:02 GMT
Content-Length: 122
Connection: close

{
  "error": "Cannot validate input",
  "details": [
    {
      "level": "error",
      "field": "workingdir",
      "message": "The path must be absolute"
    }
  ]
}
```

## Server management

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/v1/ready` | Health check endpoint |
| POST | `/v1/heartbeat` | Keep server alive and track activity |
| DELETE | `/v1/server` | Gracefully shutdown the server |

