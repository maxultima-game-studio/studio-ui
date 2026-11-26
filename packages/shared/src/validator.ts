import type {
  Condition,
  Effect,
  GameDesignBundle,
  LocalizedText,
  ValidationIssue,
} from "./schemas.js";

function checkLocalizedText(
  issues: ValidationIssue[],
  locales: string[],
  text: LocalizedText | undefined,
  fieldLabel: string,
  entityType: ValidationIssue["entity_type"],
  entityId: string
): void {
  if (!text) return;
  for (const locale of locales) {
    if (!text[locale] || text[locale].trim().length === 0) {
      issues.push({
        id: `i18n-${entityType}-${entityId}-${fieldLabel}-${locale}`,
        severity: "warning",
        code: "MISSING_TRANSLATION",
        entity_type: entityType,
        entity_id: entityId,
        message: {
          cs: `Chybí překlad (${locale.toUpperCase()}) pro pole "${fieldLabel}" u ${entityType} "${entityId}".`,
          en: `Missing (${locale.toUpperCase()}) translation for "${fieldLabel}" on ${entityType} "${entityId}".`,
        },
      });
    }
  }
}

export function validateGameDesign(bundle: GameDesignBundle): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const locales = bundle.game.locales;

  const sceneIds = new Set(bundle.scenes.map((s) => s.id));
  const charIds = new Set(bundle.characters.map((c) => c.id));
  const itemIds = new Set(bundle.items.map((i) => i.id));
  const flagIds = new Set(bundle.flags.flags.map((f) => f.id));
  const puzzleIds = new Set(bundle.puzzles.map((p) => p.id));
  const dialogueIds = new Set(bundle.dialogues.map((d) => d.id));

  const validateCondition = (
    cond: Condition | undefined,
    entityType: ValidationIssue["entity_type"],
    entityId: string,
    context: string
  ) => {
    if (!cond) return;
    if (cond.type === "flag" && !flagIds.has(cond.ref)) {
      issues.push({
        id: `ref-flag-${entityId}-${context}-${cond.ref}`,
        severity: "error",
        code: "BROKEN_FLAG_REF",
        entity_type: entityType,
        entity_id: entityId,
        message: {
          cs: `Odkaz na neexistující flag "${cond.ref}" (${context}).`,
          en: `Reference to unknown flag "${cond.ref}" (${context}).`,
        },
      });
    }
    if (cond.type === "item" && !itemIds.has(cond.ref)) {
      issues.push({
        id: `ref-item-${entityId}-${context}-${cond.ref}`,
        severity: "error",
        code: "BROKEN_ITEM_REF",
        entity_type: entityType,
        entity_id: entityId,
        message: {
          cs: `Odkaz na neexistující předmět "${cond.ref}" (${context}).`,
          en: `Reference to unknown item "${cond.ref}" (${context}).`,
        },
      });
    }
    if (cond.type === "dialogue_seen" && !dialogueIds.has(cond.ref)) {
      issues.push({
        id: `ref-dialogue-${entityId}-${context}-${cond.ref}`,
        severity: "error",
        code: "BROKEN_DIALOGUE_REF",
        entity_type: entityType,
        entity_id: entityId,
        message: {
          cs: `Odkaz na neexistující dialog "${cond.ref}" (${context}).`,
          en: `Reference to unknown dialogue "${cond.ref}" (${context}).`,
        },
      });
    }
  };

  const validateEffects = (
    effects: Effect[] | undefined,
    entityType: ValidationIssue["entity_type"],
    entityId: string,
    context: string
  ) => {
    if (!effects) return;
    for (const eff of effects) {
      if (eff.type === "set_flag" && !flagIds.has(eff.ref)) {
        issues.push({
          id: `eff-flag-${entityId}-${context}-${eff.ref}`,
          severity: "error",
          code: "BROKEN_FLAG_REF",
          entity_type: entityType,
          entity_id: entityId,
          message: {
            cs: `Efekt nastavuje neexistující flag "${eff.ref}" (${context}).`,
            en: `Effect sets unknown flag "${eff.ref}" (${context}).`,
          },
        });
      }
      if (
        (eff.type === "give_item" || eff.type === "remove_item") &&
        !itemIds.has(eff.ref)
      ) {
        issues.push({
          id: `eff-item-${entityId}-${context}-${eff.ref}`,
          severity: "error",
          code: "BROKEN_ITEM_REF",
          entity_type: entityType,
          entity_id: entityId,
          message: {
            cs: `Efekt odkazuje na neexistující předmět "${eff.ref}" (${context}).`,
            en: `Effect references unknown item "${eff.ref}" (${context}).`,
          },
        });
      }
    }
  };

  // Game config
  checkLocalizedText(issues, locales, bundle.game.title, "title", "game", bundle.game.id);
  if (bundle.game.start_scene_id && !sceneIds.has(bundle.game.start_scene_id)) {
    issues.push({
      id: `game-start-scene`,
      severity: "error",
      code: "BROKEN_START_SCENE",
      entity_type: "game",
      entity_id: bundle.game.id,
      message: {
        cs: `Startovní lokace "${bundle.game.start_scene_id}" neexistuje.`,
        en: `Start scene "${bundle.game.start_scene_id}" does not exist.`,
      },
    });
  }

  // Characters & items i18n
  for (const ch of bundle.characters) {
    checkLocalizedText(issues, locales, ch.name, "name", "character", ch.id);
  }
  for (const item of bundle.items) {
    checkLocalizedText(issues, locales, item.name, "name", "item", item.id);
    checkLocalizedText(issues, locales, item.description, "description", "item", item.id);
  }

  // Scene reachability BFS
  const startScene = bundle.game.start_scene_id ?? bundle.scenes[0]?.id;
  const reachable = new Set<string>();
  if (startScene && sceneIds.has(startScene)) {
    const queue = [startScene];
    reachable.add(startScene);
    while (queue.length > 0) {
      const current = queue.shift()!;
      const scene = bundle.scenes.find((s) => s.id === current);
      if (!scene) continue;
      for (const exit of scene.exits) {
        if (sceneIds.has(exit.target_scene_id) && !reachable.has(exit.target_scene_id)) {
          reachable.add(exit.target_scene_id);
          queue.push(exit.target_scene_id);
        }
      }
    }
  }

  // Scenes
  for (const scene of bundle.scenes) {
    checkLocalizedText(issues, locales, scene.title, "title", "scene", scene.id);
    if (startScene && !reachable.has(scene.id)) {
      issues.push({
        id: `scene-unreachable-${scene.id}`,
        severity: "warning",
        code: "UNREACHABLE_SCENE",
        entity_type: "scene",
        entity_id: scene.id,
        message: {
          cs: `Lokace "${scene.id}" není dosažitelná ze startovní lokace "${startScene}".`,
          en: `Scene "${scene.id}" is unreachable from start scene "${startScene}".`,
        },
      });
    }
    for (const charId of scene.characters) {
      if (!charIds.has(charId)) {
        issues.push({
          id: `scene-char-${scene.id}-${charId}`,
          severity: "error",
          code: "BROKEN_CHARACTER_REF",
          entity_type: "scene",
          entity_id: scene.id,
          message: {
            cs: `Lokace "${scene.id}" obsahuje neexistující postavu "${charId}".`,
            en: `Scene "${scene.id}" references unknown character "${charId}".`,
          },
        });
      }
    }
    for (const exit of scene.exits) {
      checkLocalizedText(issues, locales, exit.label, `exit.${exit.id}`, "scene", scene.id);
      if (!sceneIds.has(exit.target_scene_id)) {
        issues.push({
          id: `scene-exit-${scene.id}-${exit.id}`,
          severity: "error",
          code: "BROKEN_SCENE_REF",
          entity_type: "scene",
          entity_id: scene.id,
          message: {
            cs: `Přechod "${exit.id}" vede na neexistující lokaci "${exit.target_scene_id}".`,
            en: `Exit "${exit.id}" targets unknown scene "${exit.target_scene_id}".`,
          },
        });
      }
      validateCondition(exit.condition, "scene", scene.id, `exit:${exit.id}`);
    }
    for (const hs of scene.hotspots) {
      checkLocalizedText(issues, locales, hs.label, `hotspot.${hs.id}`, "scene", scene.id);
      if (hs.item_id && !itemIds.has(hs.item_id)) {
        issues.push({
          id: `hs-item-${scene.id}-${hs.id}`,
          severity: "error",
          code: "BROKEN_ITEM_REF",
          entity_type: "scene",
          entity_id: scene.id,
          message: {
            cs: `Hotspot "${hs.id}" odkazuje na neexistující předmět "${hs.item_id}".`,
            en: `Hotspot "${hs.id}" references unknown item "${hs.item_id}".`,
          },
        });
      }
      if (hs.dialogue_id && !dialogueIds.has(hs.dialogue_id)) {
        issues.push({
          id: `hs-dlg-${scene.id}-${hs.id}`,
          severity: "error",
          code: "BROKEN_DIALOGUE_REF",
          entity_type: "scene",
          entity_id: scene.id,
          message: {
            cs: `Hotspot "${hs.id}" odkazuje na neexistující dialog "${hs.dialogue_id}".`,
            en: `Hotspot "${hs.id}" references unknown dialogue "${hs.dialogue_id}".`,
          },
        });
      }
      if (hs.puzzle_id && !puzzleIds.has(hs.puzzle_id)) {
        issues.push({
          id: `hs-puz-${scene.id}-${hs.id}`,
          severity: "error",
          code: "BROKEN_PUZZLE_REF",
          entity_type: "scene",
          entity_id: scene.id,
          message: {
            cs: `Hotspot "${hs.id}" odkazuje na neexistující puzzle "${hs.puzzle_id}".`,
            en: `Hotspot "${hs.id}" references unknown puzzle "${hs.puzzle_id}".`,
          },
        });
      }
    }
  }

  // Puzzles
  for (const puzzle of bundle.puzzles) {
    checkLocalizedText(issues, locales, puzzle.title, "title", "puzzle", puzzle.id);
    if (!sceneIds.has(puzzle.scene_id)) {
      issues.push({
        id: `puzzle-scene-${puzzle.id}`,
        severity: "error",
        code: "BROKEN_SCENE_REF",
        entity_type: "puzzle",
        entity_id: puzzle.id,
        message: {
          cs: `Puzzle "${puzzle.id}" patří do neexistující lokace "${puzzle.scene_id}".`,
          en: `Puzzle "${puzzle.id}" belongs to unknown scene "${puzzle.scene_id}".`,
        },
      });
    }
    for (const req of puzzle.requires) {
      validateCondition(req, "puzzle", puzzle.id, "requires");
    }
    validateEffects(puzzle.effects, "puzzle", puzzle.id, "effects");
  }

  // Dialogues
  for (const dlg of bundle.dialogues) {
    checkLocalizedText(issues, locales, dlg.title, "title", "dialogue", dlg.id);
    if (dlg.scene_id && !sceneIds.has(dlg.scene_id)) {
      issues.push({
        id: `dlg-scene-${dlg.id}`,
        severity: "error",
        code: "BROKEN_SCENE_REF",
        entity_type: "dialogue",
        entity_id: dlg.id,
        message: {
          cs: `Dialog "${dlg.id}" odkazuje na neexistující lokaci "${dlg.scene_id}".`,
          en: `Dialogue "${dlg.id}" references unknown scene "${dlg.scene_id}".`,
        },
      });
    }
    if (dlg.character_id && !charIds.has(dlg.character_id)) {
      issues.push({
        id: `dlg-char-${dlg.id}`,
        severity: "error",
        code: "BROKEN_CHARACTER_REF",
        entity_type: "dialogue",
        entity_id: dlg.id,
        message: {
          cs: `Dialog "${dlg.id}" odkazuje na neexistující postavu "${dlg.character_id}".`,
          en: `Dialogue "${dlg.id}" references unknown character "${dlg.character_id}".`,
        },
      });
    }
    if (!dlg.nodes[dlg.start_node_id]) {
      issues.push({
        id: `dlg-start-${dlg.id}`,
        severity: "error",
        code: "MISSING_START_NODE",
        entity_type: "dialogue",
        entity_id: dlg.id,
        message: {
          cs: `Dialog "${dlg.id}" má neexistující startovní uzel "${dlg.start_node_id}".`,
          en: `Dialogue "${dlg.id}" has missing start node "${dlg.start_node_id}".`,
        },
      });
    }

    for (const node of Object.values(dlg.nodes)) {
      if (node.type === "npc_line") {
        checkLocalizedText(issues, locales, node.text, `node.${node.id}`, "dialogue", dlg.id);
        if (node.speaker_id && !charIds.has(node.speaker_id)) {
          issues.push({
            id: `dlg-speaker-${dlg.id}-${node.id}`,
            severity: "error",
            code: "BROKEN_CHARACTER_REF",
            entity_type: "dialogue",
            entity_id: dlg.id,
            message: {
              cs: `Uzel "${node.id}" má neexistujícího mluvčího "${node.speaker_id}".`,
              en: `Node "${node.id}" has unknown speaker "${node.speaker_id}".`,
            },
          });
        }
      }
      validateCondition(node.condition, "dialogue", dlg.id, `node:${node.id}`);
      validateEffects(node.effects, "dialogue", dlg.id, `node:${node.id}`);

      if (node.type !== "end" && node.type !== "player_choice") {
        if (!node.next_node_id) {
          issues.push({
            id: `dlg-deadend-${dlg.id}-${node.id}`,
            severity: "warning",
            code: "DIALOGUE_DEAD_END",
            entity_type: "dialogue",
            entity_id: dlg.id,
            message: {
              cs: `Uzel "${node.id}" v dialogu "${dlg.id}" nemá navazující uzel (slepá větev).`,
              en: `Node "${node.id}" in dialogue "${dlg.id}" has no next node (dead end).`,
            },
          });
        } else if (!dlg.nodes[node.next_node_id]) {
          issues.push({
            id: `dlg-next-${dlg.id}-${node.id}`,
            severity: "error",
            code: "BROKEN_DIALOGUE_NODE_REF",
            entity_type: "dialogue",
            entity_id: dlg.id,
            message: {
              cs: `Uzel "${node.id}" odkazuje na neexistující uzel "${node.next_node_id}".`,
              en: `Node "${node.id}" links to unknown node "${node.next_node_id}".`,
            },
          });
        }
      }

      if (node.type === "player_choice") {
        const choices = node.choices ?? [];
        if (choices.length === 0) {
          issues.push({
            id: `dlg-empty-choices-${dlg.id}-${node.id}`,
            severity: "warning",
            code: "EMPTY_PLAYER_CHOICES",
            entity_type: "dialogue",
            entity_id: dlg.id,
            message: {
              cs: `Uzel voleb "${node.id}" nemá žádné možnosti.`,
              en: `Choice node "${node.id}" has no options.`,
            },
          });
        }
        for (const ch of choices) {
          checkLocalizedText(
            issues,
            locales,
            ch.text,
            `node.${node.id}.choice.${ch.id}`,
            "dialogue",
            dlg.id
          );
          validateCondition(ch.condition, "dialogue", dlg.id, `choice:${ch.id}`);
          validateEffects(ch.effects, "dialogue", dlg.id, `choice:${ch.id}`);
          if (!ch.next_node_id) {
            issues.push({
              id: `dlg-choice-deadend-${dlg.id}-${node.id}-${ch.id}`,
              severity: "warning",
              code: "DIALOGUE_DEAD_END",
              entity_type: "dialogue",
              entity_id: dlg.id,
              message: {
                cs: `Volba "${ch.id}" v uzlu "${node.id}" nikam nevede.`,
                en: `Choice "${ch.id}" in node "${node.id}" has no target node.`,
              },
            });
          } else if (!dlg.nodes[ch.next_node_id]) {
            issues.push({
              id: `dlg-choice-target-${dlg.id}-${node.id}-${ch.id}`,
              severity: "error",
              code: "BROKEN_DIALOGUE_NODE_REF",
              entity_type: "dialogue",
              entity_id: dlg.id,
              message: {
                cs: `Volba "${ch.id}" vede na neexistující uzel "${ch.next_node_id}".`,
                en: `Choice "${ch.id}" links to unknown node "${ch.next_node_id}".`,
              },
            });
          }
        }
      }
    }
  }

  return issues;
}
