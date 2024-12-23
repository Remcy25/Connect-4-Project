function setup() {
    // Make game board
    const html_game_board = document.getElementById("game_board");
    for (let col_number = 0; col_number < total_column_count; col_number++) {
        const row = [];

        for (let row_number = 0; row_number < total_row_count; row_number++) {
            const cell = { x: row_number, y: col_number, used: false, color: "white" };
            const html_cell = document.createElement("div"); // Creating Visual cell

            html_cell.className = "cell"
            html_cell.id = `cell${col_number}${row_number}`
            html_cell.addEventListener("click", handle_input) // User input

            row.push(cell)
            html_game_board.appendChild(html_cell)
        }

        game_board.push(row)
    }


    // Set player values
    const root = document.documentElement;

    players.one.name = "Red";
    players.two.name = "Green";
    players.one.color = getComputedStyle(root).getPropertyValue('--player-one-color').trim();
    players.two.color = getComputedStyle(root).getPropertyValue('--player-two-color').trim();

    // Enable buttons
    document.getElementById("reset_game").addEventListener("click", () => {handle_reset_game(false)})
    document.getElementById("connect_to_server").addEventListener("click", connect_to_online_server)
    document.getElementById("disconnect_from_online_server").addEventListener("click", disconnect_from_online_server)
    document.getElementById('create_online_room').addEventListener('click', create_online_room);
    document.getElementById('join_online_room').addEventListener('click', join_online_room);

    const overlay = document.getElementById("network_overlay");
    document.getElementById("open_overlay").addEventListener("click", () => {overlay.style.visibility = "visible"; overlay.style.opacity = 1;});
    document.getElementById("close_overlay").addEventListener("click", () => {overlay.style.visibility = "hidden"; overlay.style.opacity = 0;});

    // Set first player
    is_first_counter = true;
    document.getElementById("current_player").innerHTML = `It is ${(is_first_counter) ? players.one.name : players.two.name}'s turn`
    is_playing = true;
}

function updateNetworkStatus(message) {
    document.getElementById("network_status").textContent = message;
}

function updateStatus(message) {
    document.getElementById("game_status").textContent = message;
}

// Client-Side connection Functions
function connect_to_online_server() {
    updateNetworkStatus("Connecting to server...");
    socket = new WebSocket(url);
    const server_name = prompt("What would you like your online name to be?")
    

    // WebSocket Event Handlers
    socket.onopen = function () {
        socket.send(JSON.stringify({ type: "set_player_name", name: server_name }));
        updateNetworkStatus(`Connected to the server, Welcome ${server_name}`);
        server_data.is_connected_online = true;

        document.getElementById("connect_to_server").style.display = 'none';
        document.getElementById("disconnect_from_online_server").style.display = 'block';
        document.getElementById('create_online_room').style.display = 'block';
        document.getElementById('join_online_room').style.display = 'block';
    };

    socket.onerror = function (error) {
        updateNetworkStatus("Failed to connect to server, please try again.");
        console.error('WebSocket Error: ', error);
    };

    socket.onclose = function () {
        updateNetworkStatus("Disconnected from server.")

        setTimeout( () => {updateNetworkStatus("")}, 3 * 1000)
        server_data.is_connected_online = false;

        document.getElementById("connect_to_server").style.display = 'block';
        document.getElementById("disconnect_from_online_server").style.display = 'none';
        document.getElementById('create_online_room').style.display = 'none';
        document.getElementById('join_online_room').style.display = 'none';
    };

    // Handle incoming messages (server broadcasts)
    socket.onmessage = function (event) {
        const data = JSON.parse(event.data);

        // Handle different types of events from the server
        switch (data.type) {
            case "set_player_id":
                server_data.player_id = data.data;
                break;
            case "create_room":
                server_data.is_room_creator = true;
                server_data.room_id = data.room_id;

                updateNetworkStatus(`Room created. Room ID: ${data.room_id}.`)
                break;
            case 'start_game':
                handle_start_game(data);
                break;
            case 'update_board':
                handle_update_board(data);
                break;
            case "reset_game":
                handle_reset_game(true);
                break;
            case 'player_disconnected':
                handle_opponent_disconnection(data);
                break;
            default:
                console.error('Unknown message type:', data.type);
        }
    };

}

function disconnect_from_online_server() {
    socket.close();
}

// Utility to handle WebSocket message format
function send_web_socket_message(type, data) {
    const message = JSON.stringify({ type, ...data });
    socket.send(message);
}

function create_online_room() {
    // Leave the current room if already in one
    if (server_data.room_id) {
        leave_current_room();
    }

    // Prompt the user to enter a custom room ID
    server_data.room_id = prompt('Enter a custom Room ID:');
    
    if (server_data.room_id && server_data.room_id.trim() !== "") {
        const message = JSON.stringify({ type: 'create_room', room_id: server_data.room_id.trim() });
        socket.send(message);
    } else {
        alert("Please enter a valid room ID.");
    }
}

function join_online_room() {
    // Leave the current room if already in one
    if (server_data.room_id) {
        leave_current_room();
    }

    server_data.room_id = prompt('Enter Room ID:');
    if (server_data.room_id && server_data.room_id.trim() !== "") {
        const message = JSON.stringify({ type: 'join_room', room_id: server_data.room_id.trim() });
        socket.send(message);
    } else {
        alert("Please enter a valid Room ID.");
    }
}

function leave_current_room() {
    const message = JSON.stringify({ type: 'leave_room', room_id: server_data.room_id });
    socket.send(message);
    server_data.room_id = null;
    is_playing = false;
}

// Handle the start of the game (when both players are in the room)
function handle_start_game(data) {
    players.one.name = data.players[0].name;
    players.one.id = data.players[0].id;
    players.two.name = data.players[1].name;
    players.two.id = data.players[1].id;
    
    server_data.last_players_turn = players.two.id
    updateNetworkStatus(`Game Started on room ${server_data.room_id}. Player 1: ${players.one.name}, Player 2: ${players.two.name}`)
    is_playing = true;
    reset_game();
}

// Handle updates to the game board (received from the server)
function handle_update_board(data) {
    const column = data.column;
    const currentPlayer = (server_data.player_id === data.player_id) ? players.one : players.two;

    // Update the game board based on the received data
    place_counter(currentPlayer.color, column);

    // Check for win or tie after the move
    if (check_for_win()) {
        end_game(currentPlayer.name);
    } else if (check_for_tie_game()) {
        tie_game();
    } else {
        server_data.last_players_turn = data.player_id;
        if (server_data.is_room_creator) {
            document.getElementById("current_player").innerHTML = `It is ${(server_data.player_id !== server_data.last_players_turn) ? players.one.name : players.two.name}'s turn`;
        }
        else {
            document.getElementById("current_player").innerHTML = `It is ${(server_data.player_id === server_data.last_players_turn) ? players.one.name : players.two.name}'s turn`;
        }
    }
}

function handle_reset_game(received_from_online) {
    if (!server_data.is_connected_online) {
        reset_game();
        return;
    }

    if (received_from_online) {
        reset_game();
    }
    else {
        const message = JSON.stringify({ type: "reset_game", room_id: server_data.room_id } );
        socket.send(message);
    }
}

// Handle player disconnection (received from the server)
function handle_opponent_disconnection(data) {
    updateNetworkStatus(`Player disconnected: ${data.player_name}`)
    setTimeout( () => {updateNetworkStatus("")}, 3 * 1000)
    alert(`${data.player_name} has disconnected. The game will end.`);

    is_playing = false;
    server_data.room_id = null;
}

// Connect 4
function reset_game() {
    // Resetting Game_board
    for (let col_number = 0; col_number < total_column_count; col_number++) {
        for (let row_number = 0; row_number < total_row_count; row_number++) {
            const html_cell = document.getElementById(`cell${col_number}${row_number}`)

            html_cell.style.setProperty('--after-bg', '#ffffff');
            game_board[col_number][row_number] = { x: row_number, y: col_number, used: false, color: "white" }
        }
    }

    const root = document.documentElement;
    const html_current_player = document.getElementById("current_player")

    

    
    if (server_data.is_connected_online) {
        if (server_data.is_room_creator) {
            players.one.color = getComputedStyle(root).getPropertyValue('--player-one-color').trim();
            players.two.color = getComputedStyle(root).getPropertyValue('--player-two-color').trim();
            document.getElementById("current_player").innerHTML = `It is ${(server_data.player_id !== server_data.last_players_turn) ? players.one.name : players.two.name}'s turn`;
        }
        else {
            players.one.color = getComputedStyle(root).getPropertyValue('--player-two-color').trim();
            players.two.color = getComputedStyle(root).getPropertyValue('--player-one-color').trim();
            document.getElementById("current_player").innerHTML = `It is ${(server_data.player_id === server_data.last_players_turn) ? players.one.name : players.two.name}'s turn`;
        }
    }
    else {
        is_first_counter = true;
        players.one.color = getComputedStyle(root).getPropertyValue('--player-one-color').trim();
        players.two.color = getComputedStyle(root).getPropertyValue('--player-two-color').trim();
        html_current_player.innerHTML = `It's ${(is_first_counter) ? players.one.name : players.two.name}'s turn`
    }

    html_current_player.style.display = "block";
    updateStatus("")
    is_playing = true;
}

function is_column_full(column) {
    return game_board[column].every((cell) => cell.used === true);
}

function find_next_free_row_index(column) {
    for (let i = total_row_count - 1; i > -1; i--) {
        const row = game_board[column][i]

        if (row.used === false) {
            return row.x;
        }
    }

    return null;
}

function place_counter(current_player_color, column) {
    const next_free_row = find_next_free_row_index(column)
    const html_cell = document.getElementById(`cell${next_free_row}${column}`) // Gets visual cell

    game_board[column][next_free_row].used = true;
    game_board[column][next_free_row].colour = current_player_color;
    html_cell.style.setProperty('--after-bg', current_player_color);
}

function convert_target_to_cell(event_target_id) {
    event_target_id = event_target_id.replace("cell", "")

    const [row, col] = event_target_id.split("");

    return game_board[col][row]
}

function has_four_counters_in_a_row(col, row, dx, dy, colour) {
    let count = 0;

    for (let i = 0; i < 4; i++) {
        const newCol = col + i * dx;
        const newRow = row + i * dy;

        if (
            newCol >= 0 &&
            newCol < total_column_count &&
            newRow >= 0 &&
            newRow < total_row_count &&
            game_board[newCol][newRow].used &&
            game_board[newCol][newRow].colour === colour
        ) {
            count++;
        }
        else {
            break;
        }
    }

    return count === 4;
}

function check_for_win() {
    const directions = [
        { dx: 1, dy: 0 },  // Horizontal (right)
        { dx: 0, dy: 1 },  // Vertical (down)
        { dx: 1, dy: 1 },  // Diagonal (down-right)
        { dx: 1, dy: -1 }  // Diagonal (up-right)
    ];

    for (let col = 0; col < total_column_count; col++) {
        for (let row = 0; row < total_row_count; row++) {
            const cell = game_board[col][row];

            if (cell.used) {
                // Check each direction for a winning line
                for (const { dx, dy } of directions) {
                    if (has_four_counters_in_a_row(col, row, dx, dy, cell.colour)) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

function end_game(winningPlayer) {
    is_playing = false;
    updateStatus(`${winningPlayer} has won!`)
    document.getElementById("current_player").style.display = "none";
}

function tie_game() {
    is_playing = false;
    updateStatus("Tie Game")
    document.getElementById("current_player").style.display = "none";
}

function check_for_tie_game() {
    return game_board.every((column_data, column_index) => is_column_full(column_index) === true)
}

function handle_input(event) {
    const cell = convert_target_to_cell(event.target.id);

    // Validate turn
    if (!cell || !is_playing || is_column_full(cell.y)) {
        return;
    }

    if (server_data.is_connected_online) {
        if (server_data.player_id !== server_data.last_players_turn) {
            send_web_socket_message("make_move", { room_id: server_data.room_id, column: cell.y } )
        }
        return;
    }

    // Use player turn
    const current_player = (is_first_counter) ? players.one : players.two;
    place_counter(current_player.color, cell.y)


    // Check if game is ending
    if (check_for_win(cell.x, cell.y)) {
        end_game(current_player.name)
        return;
    }
    else if (check_for_tie_game()) {
        tie_game()
        return;
    }
    else {
        // Switch player
        is_first_counter = !is_first_counter;
        document.getElementById("current_player").innerHTML = `It is ${(is_first_counter) ? players.one.name : players.two.name}'s turn`
    }
}

let is_playing, is_first_counter, socket;
const game_board = []; // [col][row]
const total_row_count = 7; // Horizontal
const total_column_count = 7; // Vertical
const players = { one: { name: "", color: "" }, two: { name: "", color: "" } };
const url = 'https://connect-4-server-for-uni.glitch.me/';
const server_data = { is_connected_online: false, room_id: null, player_id: null, last_players_turn: null, is_room_creator: false };

setup()