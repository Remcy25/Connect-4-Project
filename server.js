const WebSocket = require('ws');

// Create the WebSocket server
const wss = new WebSocket.Server({ port: 3000 });

// Room management
const rooms = {}; // Store room data
const user_ids = new Set()

wss.on('connection', (ws) => {
    console.log('A user connected');

    // Setup Id's
    ws.id = generate_user_id(1000);
    ws.send(JSON.stringify({ type: "set_player_id", data: ws.id }));

    // Set up a simple listener for incoming messages
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        console.log('Received:', data);

        switch (data.type) {
            case "set_player_name":
                ws.name = data.name;
                break;
            case 'create_room':
                create_room(ws, data.room_id);  // Pass the roomId to the createRoom function
                break;

            case 'join_room':
                join_room(ws, data.room_id);   // Join room logic remains unchanged
                break;

            case 'make_move':
                make_move(ws, data.room_id, data.column);  // Make move logic
                break;
            case 'reset_game':
                reset_game(ws, data.room_id);
                break;
            default:
                console.error('Unknown message type:', data.type);
        }
    });

    // Handle disconnect
    ws.on('close', () => {
        console.log('A user disconnected');
        handle_disconnection(ws);
    });
});

// Function to create a room with a custom room ID
function create_room(ws, room_id) {
    if (rooms[room_id]) {
        // If the room already exists, send an error to the client
        ws.send(JSON.stringify({ success: false, message: 'Room ID already taken.' }));
    } else {
        // If the room doesn't exist, create the room with the custom ID
        rooms[room_id] = { players: [ws], game_state: null };
        ws.send(JSON.stringify({ type: 'create_room', room_id: room_id, is_room_creator: true }));
    }
}

// Function to join a room
function join_room(ws, room_id) {
    if (rooms[room_id] && rooms[room_id].players.length < 2) {
        rooms[room_id].players.push(ws);

        // Notify both players that the game can start
        rooms[room_id].players.forEach((player_ws) => {
            player_ws.send(JSON.stringify({
                type: 'start_game',
                players: rooms[room_id].players.map((player) => { return { id: player.id, name: player.name} })
            }));
        });

        ws.send(JSON.stringify({ success: true, message: 'Joined the room successfully.' }));
    } else {
        ws.send(JSON.stringify({ success: false, message: 'Room is full or does not exist.' }));
    }
}

// Function to handle player move
function make_move(ws, room_id, column) {
    if (rooms[room_id]) {
        rooms[room_id].players.forEach((player_ws) => {
            player_ws.send(JSON.stringify({
                type: 'update_board',
                player_id: ws.id,
                column
            }));
        });
    } else {
        ws.send(JSON.stringify({ success: false, message: 'Room not found.' }));
    }
}

function reset_game(ws, room_id) {
    if (rooms[room_id]) {
        rooms[room_id].players.forEach((player_ws) => {
            player_ws.send(JSON.stringify({
                type: 'reset_game'
            }));
        });
    } else {
        ws.send(JSON.stringify({ success: false, message: 'Room not found.' }));
    }
}

// Function to handle disconnections
function handle_disconnection(ws) {
    for (const [roomId, room] of Object.entries(rooms)) {
        if (room.players.includes(ws)) {
            room.players = room.players.filter(player => player !== ws);

            // Notify remaining players if any
            if (room.players.length === 0) {
                delete rooms[roomId];
            } else {
                room.players.forEach((player_ws) => {
                    player_ws.send(JSON.stringify({
                        type: 'player_disconnected',
                        player_name: ws.name
                    }));
                });
            }
            break;
        }
    }

    user_ids.delete(ws.id);
}

// Function to make unique user ids
function generate_user_id(max) {
    let new_id = Math.floor((Math.random() * max))
    while (user_ids.has(new_id)) { // Unique Id
        new_id = generate_user_id(10000);
    }
    user_ids.add(new_id);

    return new_id
}
 
console.log(`WebSocket server is running on https://${process.env.PROJECT_DOMAIN || 'localhost'}:${3000}`);