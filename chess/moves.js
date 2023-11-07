const FILES = 'abcdefgh';
const RANKS = '87654321';
const TYPES = '♔♕♖♗♘♙';
const PIECES = {
    'white': '♔♕♖♗♘♙',
    'black': '♚♛♜♝♞♟',
}
const STANDARD_POSITION = '♜♞♝♛♚♝♞♜/♟♟♟♟♟♟♟♟/8/8/8/8/♙♙♙♙♙♙♙♙/♖♘♗♕♔♗♘♖ white ♔♕♚♛ -';
const INVERT = { 'white': 'black', 'black': 'white' }
const CASTLE_TYPES = {
    'white': { 'a': '♕', 'h': '♔' },
    'black': { 'a': '♛', 'h': '♚' },
}
const PROMOTIONS = { 'white': '♕♖♗♘', 'black': '♛♜♝♞' }

const straightSteps = [[-1, 0], [0, -1], [1, 0], [0, 1]];
const diagonalSteps = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const bothSteps = straightSteps.concat(diagonalSteps);
const gallopSteps = [
    [-2, 1], [-1, -2], [2, -1], [1, 2],
    [-2, -1], [1, -2], [2, 1], [-1, 2]];
const pawnSteps = {
    'white': [RANKS.indexOf('2'), [-1, 0], [[-1, -1], [-1, 1]], RANKS.indexOf('8')],
    'black': [RANKS.indexOf('7'), [1, 0], [[1, -1], [1, 1]], RANKS.indexOf('1')],
}
const enpassantStep = {
    [RANKS.indexOf('3')]: [-1, 0],
    [RANKS.indexOf('6')]: [1, 0]
}

const castleSteps = [[0, -1], [0, 1]];

function getValidMoves(board, lastMove, from, piece) {
    const { activeColor, enpassant, castles } = lastMove;
    const walk = makeWalk(board, from);
    const walks = makeWalks(walk);
    const vacant = ({ to }) => to && !to.piece;
    const attackable = ({ to }) => to?.piece && to.piece.color != activeColor;
    const landable = (_) => vacant(_) || attackable(_);
    switch (piece?.type) {
        case '♔': {
            const moves = bothSteps.map(walk).filter(landable);
            const removeCastles = castles.filter(c => c.color == activeColor);
            const isCastle = move => removeCastles.includes(move?.to?.piece);
            const hostiles = getHostileMoves(board, lastMove);
            const safeSquare = x => hostiles.every(y => x.to != y.to);
            const safePath = path => path.slice(0,2).every(safeSquare) ? path : [];
            const lastStep = step => safePath(walks(step)).pop();
            moves.push(...castleSteps.map(lastStep).filter(isCastle));
            moves.forEach(move => Object.assign(move, { removeCastles }));
            return moves;
        }
        case '♕': {
            return bothSteps.flatMap(walks).filter(landable);
        }
        case '♖': {
            const moves = straightSteps.flatMap(walks).filter(landable);
            const removeCastles = castles.filter(c => c == piece);
            moves.forEach(move => Object.assign(move, { removeCastles }));
            return moves;
        }
        case '♗': {
            return diagonalSteps.flatMap(walks).filter(landable);
        }
        case '♘': {
            return gallopSteps.map(walk).filter(landable);
        }
        case '♙': {
            const [firstR, step, attacks, lastR] = pawnSteps[piece.color];
            const count = firstR == from.r ? 2 : 1;
            const moves = walks(step).filter(vacant).slice(0, count);
            if (moves[1]) moves[1].enpassant = moves[0].to;
            moves.push(...attacks.map(walk).filter(attackable));
            if (enpassant && attackable(enpassantWalk(board, enpassant))) {
                moves.push(...attacks.map(walk).filter(s => s.to == enpassant));
            }
            moves.forEach(move => {
                if (move.to.r == lastR) Object.assign(move, {
                    promotions: PROMOTIONS[piece.color].split('')
                });
            })
            return moves;
        }
        default: return [];
    }
}

function getHostileMoves(board, { activeColor }) {
    const moves = [];
    board.forEach((from) => {
        const piece = from.piece;
        if (!piece || piece.color == activeColor) return;
        const walk = makeWalk(board, from);
        const walks = makeWalks(walk);
        const vacant = ({ to }) => to && !to.piece;
        switch (piece.type) {
            case '♔':
                moves.push(...bothSteps.map(walk).filter(vacant));
                break;
            case '♕':
                moves.push(...bothSteps.flatMap(walks).filter(vacant));
                break;
            case '♖':
                moves.push(...straightSteps.flatMap(walks).filter(vacant));
                break;
            case '♗':
                moves.push(...diagonalSteps.flatMap(walks).filter(vacant));
                break;
            case '♘':
                moves.push(...gallopSteps.map(walk).filter(vacant));
                break;
            case '♙':
                const attacks = pawnSteps[piece.color][2];
                moves.push(...attacks.map(walk).filter(vacant))
                break;
        }
    });
    return moves;
}

const makeWalk = ({ squares }, { r, f }) => ([dr, df]) => (
    { to: squares[r + dr]?.[f + df] }
);

const makeWalks = (walk) => (step) => {
    let squares = [];
    let sq = walk(step);
    let [dr, df] = step;
    while (sq.to) {
        squares.push(sq);
        if (sq.to.piece) break;
        dr += step[0], df += step[1];
        sq = walk([dr, df]);
    }
    return squares;
};


function enpassantWalk(board, from) {
    return makeWalk(board, from)(enpassantStep[from.r]);
}
