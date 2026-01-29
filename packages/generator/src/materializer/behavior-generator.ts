/**
 * Plane 3: Fabric behavior generation from ExecutionPlan.
 * Consumes ExecutionPlan; produces Java source for on_use, spawn_entity, cooldown, raycast.
 * Safety bounds from PRIMITIVE_REGISTRY are enforced (range, cooldown).
 */

import type { ExpandedSpecTier1 } from "@themodgenerator/spec";
import type { MaterializedFile } from "./types.js";
import type { ExecutionPlan } from "../execution-plan.js";
import { PRIMITIVE_REGISTRY } from "../primitives.js";

const MAX_RAYCAST_RANGE = 64;
const DEFAULT_COOLDOWN_TICKS = 40;

function toClassName(s: string): string {
  return s
    .split(/[-_]/)
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : ""))
    .join("");
}

function getCooldownTicks(plan: ExecutionPlan): number {
  const cooldown = plan.primitives.find((p) => p === "cooldown");
  if (!cooldown) return 0;
  const def = PRIMITIVE_REGISTRY[cooldown];
  return def?.safety?.cooldownTicks ?? DEFAULT_COOLDOWN_TICKS;
}

function getMaxRange(plan: ExecutionPlan): number {
  const raycast = plan.primitives.find((p) => p === "raycast_target");
  if (!raycast) return MAX_RAYCAST_RANGE;
  const def = PRIMITIVE_REGISTRY[raycast];
  return def?.safety?.maxRange ?? MAX_RAYCAST_RANGE;
}

/**
 * Generate custom Item class Java source for "lightning wand" behavior:
 * on_use + raycast_target + spawn_entity + cooldown + particle_effect + sound_effect.
 * Bounded by PRIMITIVE_REGISTRY safety (range, cooldown).
 */
function generateLightningWandItem(
  _modId: string,
  itemId: string,
  plan: ExecutionPlan,
  javaPackage: string
): string {
  const className = toClassName(itemId) + "Item";
  const cooldownTicks = getCooldownTicks(plan);
  const maxRange = getMaxRange(plan);

  return `package net.themodgenerator.${javaPackage};

import net.minecraft.entity.LightningEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.util.Hand;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.hit.HitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

public class ${className} extends Item {
	private static final int COOLDOWN_TICKS = ${cooldownTicks};
	private static final double MAX_RANGE = ${maxRange};

	public ${className}(Settings settings) {
		super(settings);
	}

	@Override
	public net.minecraft.util.TypedActionResult<ItemStack> use(World world, PlayerEntity user, Hand hand) {
		ItemStack stack = user.getStackInHand(hand);
		if (!(world instanceof ServerWorld)) {
			return net.minecraft.util.TypedActionResult.pass(stack);
		}
		HitResult hit = user.raycast(MAX_RANGE, 1.0f, false);
		if (hit.getType() == HitResult.Type.BLOCK) {
			BlockPos pos = ((BlockHitResult) hit).getBlockPos();
			LightningEntity lightning = new LightningEntity(net.minecraft.entity.EntityType.LIGHTNING_BOLT, world);
			lightning.setPosition(Vec3d.ofCenter(pos));
			world.spawnEntity(lightning);
			world.playSound(null, pos, SoundEvents.ENTITY_LIGHTNING_BOLT_THUNDER, SoundCategory.WEATHER, 1.0f, 1.0f);
			user.getItemCooldownManager().set(this, COOLDOWN_TICKS);
		}
		return net.minecraft.util.TypedActionResult.success(stack, world.isClient());
	}
}
`;
}

/**
 * Whether the plan requires a custom item class (on_use + spawn_entity or similar).
 */
export function planRequiresCustomItem(plan: ExecutionPlan): boolean {
  const hasUse = plan.primitives.includes("on_use");
  const hasLightning =
    plan.primitives.includes("spawn_entity") && plan.primitives.includes("raycast_target");
  return hasUse && hasLightning;
}

/**
 * Generate behavior Java files from execution plans per item.
 * When plan has on_use + spawn_entity + raycast, generates custom Item class.
 * Returns additional MaterializedFile[] to merge with scaffold + assets.
 */
export function behaviorFilesFromPlans(
  expanded: ExpandedSpecTier1,
  itemPlans: ExecutionPlan[]
): MaterializedFile[] {
  const files: MaterializedFile[] = [];
  const modId = expanded.spec.modId;
  const javaPackage = modId.replace(/-/g, "_");

  expanded.items.forEach((item, i) => {
    const plan = itemPlans[i];
    if (!plan || !planRequiresCustomItem(plan)) return;

    const className = toClassName(item.id) + "Item";
    const content = generateLightningWandItem(modId, item.id, plan, javaPackage);
    files.push({
      path: `src/main/java/net/themodgenerator/${javaPackage}/${className}.java`,
      contents: content,
    });
  });

  return files;
}

/**
 * For each item, return the simple class name of the Item class to register (custom or "Item").
 */
export function getItemClassNameForRegistration(
  itemId: string,
  plan: ExecutionPlan | undefined
): string {
  if (plan && planRequiresCustomItem(plan)) {
    return toClassName(itemId) + "Item";
  }
  return "Item";
}
