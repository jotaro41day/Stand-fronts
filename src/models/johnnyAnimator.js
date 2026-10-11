export function createJohnnyAnimator(bones) {
  const restHipY = bones.hips.position.y;
  const restArmZ = bones.rightArm.position.z;
  let walkPhase = 0;
  let movement = 0;
  let attackStarted = -Infinity;

  return {
    triggerAttack(now) {
      attackStarted = now;
    },
    update(now, speed, seconds) {
      movement += (Math.min(1, Math.max(0, speed)) - movement) * (1 - Math.exp(-seconds * 12));
      walkPhase += movement * seconds * 12;
      const stride = Math.sin(walkPhase) * movement;
      const attackAge = (now - attackStarted) / 280;
      const punch = attackAge >= 0 && attackAge <= 1 ? Math.sin(Math.PI * attackAge) : 0;

      bones.hips.position.y = restHipY + Math.abs(Math.sin(walkPhase)) * movement * .035;
      bones.hips.rotation.z = Math.sin(walkPhase) * movement * .025;
      bones.torso.scale.y = 1 + Math.sin(now * .003) * .012;
      bones.torso.rotation.z = -Math.sin(walkPhase) * movement * .025;
      bones.head.rotation.z = Math.sin(now * .0017) * .012 + stride * .018;
      bones.leftLeg.rotation.x = stride * .58;
      bones.rightLeg.rotation.x = -stride * .58;
      bones.leftArm.rotation.x = -stride * .34;
      bones.rightArm.rotation.x = stride * .34 - punch * 1.15;
      bones.rightArm.position.z = restArmZ + punch * .08;
    },
  };
}
