export function saveSeat(gameId: string, token: string) {
  localStorage.setItem(`seat:${gameId}`, token);
}
export function loadSeat(gameId: string) {
  return localStorage.getItem(`seat:${gameId}`);
}
export function loadName() {
  return localStorage.getItem("player-name") ?? "";
}
export function saveName(n: string) {
  localStorage.setItem("player-name", n);
}
