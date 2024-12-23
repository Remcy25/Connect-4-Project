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
    document.getElementById("reset_game").addEventListener("click", reset_game)

    // Set first player
    is_first_counter = true;
    document.getElementById("current_player").innerHTML = `It is ${(is_first_counter) ? players.one.name : players.two.name}'s turn`
    is_playing = true;
}

function updateStatus(message) {
    document.getElementById("game_status").textContent = message;
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
    
    is_first_counter = true;
    players.one.color = getComputedStyle(root).getPropertyValue('--player-one-color').trim();
    players.two.color = getComputedStyle(root).getPropertyValue('--player-two-color').trim();
    html_current_player.innerHTML = `It's ${(is_first_counter) ? players.one.name : players.two.name}'s turn`

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

let is_playing, is_first_counter;
const game_board = []; // [col][row]
const total_row_count = 7; // Horizontal
const total_column_count = 7; // Vertical
const players = { one: { name: "", color: "" }, two: { name: "", color: "" } };

setup()