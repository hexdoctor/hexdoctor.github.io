class ChessSquare {
    constructor(r, f) {
        [this.r, this.f] = [r, f];
        this.file = FILES[this.f];
        this.rank = RANKS[this.r];
        this.color = (r + f) % 2 ? 'black' : 'white';
        this.id = this.file + this.rank;
        this.td = document.createElement('TD');
        this.td.classList.add(this.color);
        this.td.id = this.id = this.file + this.rank;
    }

    static parseId(id) {
        return [
            RANKS.indexOf(id[1]),
            FILES.indexOf(id[0]),
        ]
    }

    place(piece) {
        this.td.replaceChildren(piece.el);
    }
    empty() {
        this.td.replaceChildren();
    }
    get piece() {
        const el = this.td.firstElementChild;
        return el && ChessPiece.fromElement(el);
    }

    select() {
        this.td.classList.add('selectable');
    }
    deselect() {
        this.td.classList.remove('selectable');
    }
}

class ChessPiece {
    constructor(id) {
        let i;
        if ((i = PIECES.black.indexOf(id)) != -1) {
            this.type = TYPES[i];
            this.color = 'black';
        } else if ((i = PIECES.white.indexOf(id)) != -1) {
            this.type = TYPES[i];
            this.color = 'white';
        } else {
            throw `Unknown chess piece ${id}`;
        }
        this.id = id;
        this.el = document.createElement('IMG');
        this.el.src = `pieces/${id}.svg`;
        this.el[Symbol.for('chess.piece')] = this;
    }

    static fromElement(el) { return el[Symbol.for('chess.piece')]; }

    select() {
        this.el.classList.add('selected');
        // To avoid a clipping problem when tables is flipped
        this.el.parentElement.style.zIndex = 1;
    }
    deselect() {
        this.el.classList.remove('selected');
        this.el.parentElement.style.zIndex = 'revert';
    }
}

class ChessBoard {
    squares = Array.from({ length: 8 }).map(() => Array.from({ length: 8 }));
    forEach(callback) {
        for (let r = 0; r < 8; ++r) {
            for (let f = 0; f < 8; ++f) {
                callback(this.squares[r][f], r, f);
            }
        }
    }
    getSquare(id) {
        const [r, f] = ChessSquare.parseId(id);
        return this.squares[r]?.[f];
    }
    constructor(onClick) {
        this.table = document.querySelector('TABLE');
        table.textContent = '';
        this.forEach((_, r, f) => {
            const square = new ChessSquare(r, f);
            this.squares[r][f] = square;
            table.append(square.td);
        })

        this.handleClick = ({ target }) => {
            while (target && target.tagName != 'TD') {
                target = target.parentElement;
            }
            if (target) {
                onClick(this.getSquare(target.id));
            }
        }

        table.addEventListener('click', this.handleClick);
    }

    dispose() {
        this.table.removeEventListener('click', this.handleClick);
    }

    setup(position = STANDARD_POSITION) {
        const [
            placement, activeColor, castleTypes, enpassantId
        ] = position.split(' ');

        const pieces = placement.split('/').map(
            line => line.replace(/[1-8]/g, (x) => ' '.repeat(x))
        );

        const castles = [];
        this.forEach((square, r, f) => {
            const id = pieces[r][f];
            if (id != ' ') {
                const piece = new ChessPiece(id);
                square.place(piece);
                const castleType = piece.type == '♖' && CASTLE_TYPES[piece.color]?.[square.file];
                if (castleType && castleTypes.includes(castleType)) {
                    castles.push(piece);
                    piece.castleType = castleType;
                }
            }
        })
        const enpassant = this.getSquare(enpassantId);
        return { placement, activeColor, enpassant, castles };
    }

    toString() {
        let placement = '';
        this.forEach(square => {
            placement += square.piece?.id || ' ';
            if (square.file == 'h' && square.id != 'h1') {
                placement += '/';
            }
        });
        return placement.replace(/(\s)+/g, x => x.length);
    }
}

class ChessGame {

    constructor(position) {
        this.tray = document.querySelector('#tray');
        this.reset(position)
    }

    reset(position) {
        this.selectedPiece = null;
        this.selectableMoves = [];
        this.board?.dispose();
        this.board = new ChessBoard(this.onClick.bind(this));
        this.historyMoves = [this.board.setup(position)];
        this.futureMoves = [];
        this.tray.textContent = '';
        this.capturedPieces = [];
        //this.tray.style.after.content = "BAJS";
    }

    quit() { this.gameover = true; }

    dispose() {
        this.board.dispose();
    }

    get hasHistory() { return this.historyMoves.length > 1; }
    get hasFuture() { return this.futureMoves.length > 0; }

    get lastMove() { return this.historyMoves.slice(-1)[0]; };
    get secondLastMove() { return this.historyMoves.slice(-2)[0]; };
    get nextMove() { return this.futureMoves.slice(-1)[0]; };

    onDialog(dialog) {
        dialog.disable('#redo-button', !this.hasFuture);
        dialog.disable('#undo-button', !this.hasHistory);
    }

    onClick(square) {
        const piece = square.piece;
        const selectedMove = this.getSelectableMoveTo(square);
        const isSelecting = !selectedMove && piece != this.selectedPiece;
        const isActiveColor = piece?.color == this.lastMove.activeColor;

        if (selectedMove) {
            this.doMove(selectedMove);
        }

        if (this.selectedPiece) {
            this.selectedPiece.deselect();
            this.selectedPiece = null;
        }

        if (piece && isSelecting && isActiveColor) {
            piece.select();
            this.selectedPiece = piece;
        }

        this.updateSelectableMoves(square, this.selectedPiece);
    }

    enpassantWalk(from) {
        return enpassantWalk(this.board, from).to;
    }

    async doMove(next, keepFuture = false) {
        this.keepTime(next);
        const last = this.lastMove;
        next.toPiece = next.to.piece;
        next.activeColor = INVERT[last.activeColor];

        if (next.toPiece?.type == '♔') {
            next.winner = last.activeColor;
        }

        if (next.piece.type == '♔') {
            next.castles = last.castles.filter(c => c.color != last.activeColor);
        } else if (next.piece.type == '♖') {
            next.castles = last.castles.filter(c => c != next.piece);
        } else {
            next.castles = last.castles;
        }

        if (next.to.piece?.color == last.activeColor) {
            this.doCastling(next);
        } else {
            if (next.toPiece) this.capturePiece(next.toPiece);
            next.to.place(next.piece);
            if (next.piece.type == '♙' && next.to == last.enpassant) this.doEnpassant(next);
            await this.doPromotion(next);
        }

        if (!keepFuture) this.futureMoves.length = 0;
        this.historyMoves.push(next);
        dropSound.play();
    }

    capturePiece(piece) {
        this.capturedPieces.push(piece);
        this.capturedPieces.sort((a,b) => a.id.charCodeAt(0) - b.id.charCodeAt(0));
        this.tray.replaceChildren(...this.capturedPieces.map(p => p.el));
    }

    keepTime(next) {
        if (!next.time) next.time = Date.now();
        if (this.historyMoves.length > 2) {
            const { secondLastMove, lastMove } = this;
            next.delay = secondLastMove.delay + next.time - lastMove.time;
        } else {
            next.delay = 0
        }
    }

    doEnpassant(next) {
        const to = this.enpassantWalk(next.to);
        next.enpassantPiece = to.piece;
        this.capturePiece(to.piece);
        to.empty();
    }

    doCastling(next) {
        const king = next.from;
        const rook = next.to;
        const fileSquares = this.board.squares[rook.r];
        const castleHops = { 'a': [+3, -2], 'h': [-2, 2] };
        const [dRook, dKing] = castleHops[next.to.file];
        fileSquares[rook.f + dRook].place(rook.piece);
        fileSquares[king.f + dKing].place(king.piece);
        next.castled = next.to.file;
    }

    async doPromotion(next) {
        if (next.promotions && !next.promoted) { // it might already be set during redo
            const pieces = next.promotions.map(id => new ChessPiece(id));
            next.promoted = await showDialog(
                '',
                pieces.map(p => p.el),
                ChessPiece.fromElement,
            );
        }
        if (next.promoted) next.to.place(next.promoted);
    }

    undoMove() {
        this.updateSelectableMoves();
        if (!this.hasHistory) return;
        const last = this.historyMoves.pop();
        this.futureMoves.push(last);
        const { piece, from, to, toPiece, promoted, enpassantPiece } = last;
        from.place(piece);
        if (promoted) to.empty();
        if (toPiece) to.place(toPiece);
        if (enpassantPiece) this.enpassantWalk(to).place(enpassantPiece);
    }

    redoMove() {
        this.updateSelectableMoves();
        const next = this.futureMoves.pop();
        if (next) this.doMove(next, true);
    }

    debugMove({ piece, from, to, enpassant, toPiece, castled }) {
        console.log('---- MOVE ----');
        if (castled) {
            if (castled == 'a') console.log('castled queen-side');
            if (castled == 'h') console.log('castled king-side');
        } else {
            console.log('moved', piece.id, 'from', from.id, 'to', to.id);
            if (toPiece) console.log('    ', 'attacking', toPiece.id);
            if (enpassant) console.log('    ', 'passing', enpassant?.id);
        }
        console.log(this.toString(), '\n');
    }

    toString() {
        const { activeColor, enpassant, castles } = this.lastMove;
        const enpassantCellId = enpassant?.id || '-';
        const castleTypes = castles.map(c => c.castleType).join('') || '-';
        return `${this.board.toString()} ${activeColor} ${castleTypes} ${enpassantCellId}`;
    }

    getSelectableMoveTo(square) {
        return this.selectableMoves.find(({ to }) => to == square);
    }

    updateSelectableMoves(from, piece) {
        this.selectableMoves.forEach(({ to }) => to.deselect());
        this.selectableMoves = [];
        if (!piece || this.lastMove.winner) return;
        this.selectableMoves = this.getMoves(from, piece);
        this.selectableMoves.forEach(move => move.to.select());
    }

    updateCastles(move) {
        const removeCastles = move.removeCastles || [];
        const remaining = (castle) => !removeCastles.includes(castle);
        const castles = this.lastMove.castles.filter(remaining);
        return Object.assign(move, { castles });
    }

    getMoves(from, piece) {
        const moves = getValidMoves(this.board, this.lastMove, from, piece);
        moves.forEach(move => Object.assign(this.updateCastles(move), { piece, from }));
        return moves;
    }

    getAllMoves() {
        const { activeColor } = this.lastMove;
        const moves = [];
        this.board.forEach((from) => {
            const piece = from.piece;
            if (piece?.color == activeColor) {
                moves.push(...this.getMoves(from, piece));
            }
        })
        return moves;
    }

}

const TEST_POSITION = '♜3♚2♜/8/8/8/8/8/8/♖3♔2♖ white ♔♕♚♛ -';
const TEST2_POSITION = '♜♞♝♛♚♝♞♜/44/8/8/8/8/44/♖♘♗♕♔♗♘♖ white ♔♕♚♛ -';

