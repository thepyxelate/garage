import './style.css';
import './game.js';
import { connect } from './net/connect.js';

// game.js exposes its network seam as window.ravenNet; connect() swaps in Firebase when src/net/config.js is filled in
connect(window.ravenNet);
