export function createTuskAnimator(bones) {
  const restHipY = bones.hips.position.y;
  const restArmZ = bones.rightArm.position.z;
  let attackStarted = -Infinity;

  return {
    triggerAttack(now) {
      attackStarted = now;
    },
    update(now) {
      const attackAge = (now - attackStarted) / 300;
      const punch = attackAge >= 0 && attackAge <= 1 ? Math.sin(Math.PI * attackAge) : 0;

      bones.hips.position.y = restHipY + Math.sin(now * .0035) * .012;
      bones.torso.rotation.z = Math.sin(now * .002) * .025;
      bones.torso.rotation.x = punch * .10;
      bones.head.rotation.z = Math.sin(now * .0018) * .018;
      bones.leftLeg.rotation.x = 0;
      bones.rightLeg.rotation.x = 0;
      bones.leftArm.rotation.x = punch * .12;
      bones.rightArm.rotation.x = -punch * 1.1;
      bones.rightArm.position.z = restArmZ + punch * .07;
    },
  };
}
