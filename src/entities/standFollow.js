export function standPosition(player, aim) {
  const behind = 1.12;
  const side = .48;
  return {
    x: player.x - aim.x * behind + aim.y * side,
    z: player.z - aim.y * behind - aim.x * side,
  };
}

export function standHoverHeight(time) {
  return .35 + Math.sin(time * .0035) * .08;
}
