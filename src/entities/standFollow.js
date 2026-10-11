export function standPosition(player, aim, out = {}) {
  const behind = 1.12;
  const side = .48;
  out.x = player.x - aim.x * behind + aim.y * side;
  out.z = player.z - aim.y * behind - aim.x * side;
  return out;
}

export function standHoverHeight(time) {
  return .35 + Math.sin(time * .0035) * .08;
}
