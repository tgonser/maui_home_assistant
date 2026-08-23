import test from "node:test";
import assert from "node:assert/strict";
import {
  createStormPrepSession,
  isProtectedStormPrepTransport,
  isSensitiveStormPrepCall,
  isSensitiveStormPrepWsCommand,
  potentialStormPrepControlEntityIds,
  potentialStormPrepWsControlEntityIds,
  stormPrepSessionExpiry,
  stormPrepSessionCookie,
} from "./stormPrepSecurity.ts";

test("recognizes protected storm-prep script calls", () => {
  assert.equal(
    isSensitiveStormPrepCall("/api/services/script/turn_on", {
      entity_id: "script.maui_storm_prep_approve",
    }),
    true,
  );
  assert.equal(
    isSensitiveStormPrepCall(
      "/api/services/script/maui_storm_prep_approve",
      {},
    ),
    true,
  );
  assert.equal(
    isSensitiveStormPrepCall("/api/services/script/turn_on", {
      entity_id: "script.some_unrelated_script",
    }),
    true,
  );
  assert.equal(
    isSensitiveStormPrepCall("/api/services/homeassistant/turn_on", {
      entity_id: "script.maui_storm_prep_approve",
    }),
    true,
  );
  assert.equal(
    isSensitiveStormPrepCall("/api/events/mobile_app_notification_action", {
      action: "MAUI_STORM_PREP_APPROVE_request-token",
    }),
    true,
  );
});

test("recognizes direct REST and WebSocket battery-control bypasses", () => {
  assert.equal(
    isSensitiveStormPrepCall("/api/services/number/set_value", {
      entity_id: "number.powerwall_backup_reserve",
      value: 100,
    }),
    true,
  );
  assert.equal(
    isSensitiveStormPrepCall("/api/services/switch/turn_on", {
      target: { entity_id: "switch.enphase_storm_watch" },
    }),
    true,
  );
  assert.equal(
    isSensitiveStormPrepCall("/api/services/switch/turn_on", {
      target: { entity_id: "switch.kitchen_pendant_lights" },
    }),
    false,
  );
  assert.equal(
    isSensitiveStormPrepCall("/api/services/switch/turn_on", {
      target: {
        entity_id: "switch.kitchen_pendant_lights",
        device_id: "battery-device",
      },
    }),
    true,
  );
  assert.equal(
    isSensitiveStormPrepCall("/api/services/switch/turn_off", {
      data: {
        target: {
          entity_id: "switch.kitchen_pendant_lights",
          area_id: ["battery-room"],
        },
      },
    }),
    true,
  );
  assert.equal(
    isSensitiveStormPrepCall("/api/services/switch/turn_on", {
      target: { entity_id: "switch.control_1" },
    }),
    true,
  );
  assert.deepEqual(
    potentialStormPrepControlEntityIds(
      "/api/services/switch/turn_on",
      {
        target: { entity_id: "switch.control_lights" },
      },
    ),
    ["switch.control_lights"],
  );
  assert.equal(
    isSensitiveStormPrepWsCommand({
      type: "call_service",
      domain: "select",
      service: "select_option",
      target: { entity_id: "select.solaredge_battery_mode" },
      service_data: { option: "Backup" },
    }),
    true,
  );
  assert.deepEqual(
    potentialStormPrepWsControlEntityIds({
      type: "call_service",
      domain: "switch",
      service: "turn_on",
      target: { entity_id: "switch.control_lights" },
    }),
    ["switch.control_lights"],
  );
  assert.equal(
    isSensitiveStormPrepWsCommand({
      type: "call_service",
      domain: "switch",
      service: "turn_on",
      target: {
        entity_id: "switch.kitchen_pendant_lights",
        device_id: "battery-device",
      },
    }),
    true,
  );
  assert.equal(
    isSensitiveStormPrepWsCommand({
      type: "fire_event",
      event_type: "mobile_app_notification_action",
      event_data: {
        action: "MAUI_STORM_PREP_DECLINE_request-token",
      },
    }),
    true,
  );
  assert.equal(
    isSensitiveStormPrepCall("/api/services/light/turn_on", {
      entity_id: "light.kitchen",
    }),
    false,
  );
  assert.equal(
    isSensitiveStormPrepCall("/api/services/select/select_option", {
      entity_id: "select.gonser_operation_mode",
      option: "Backup",
    }),
    true,
  );
  assert.equal(
    isSensitiveStormPrepCall("/api/services/automation/trigger", {
      entity_id: "automation.maui_storm_prep_reconcile",
    }),
    true,
  );
  assert.equal(
    isSensitiveStormPrepCall("/api/services/input_text/set_value", {
      entity_id: "input_text.maui_storm_prep_previous_entity",
      value: "select.gonser_operation_mode",
    }),
    true,
  );
  assert.equal(
    isSensitiveStormPrepCall("/api/services/input_number/set_value", {
      entity_id: "input_number.maui_storm_prep_duration_hours",
      value: 120,
    }),
    true,
  );
  assert.equal(
    isSensitiveStormPrepWsCommand({
      type: "call_service",
      domain: "input_number",
      service: "set_value",
      service_data: {
        entity_id: "input_number.maui_storm_prep_duration_hours",
        value: 120,
      },
    }),
    true,
  );
  assert.equal(
    isSensitiveStormPrepCall(
      "/api/states/input_boolean.maui_storm_prep_recovery_required",
      { state: "on" },
    ),
    true,
  );
});

test("accepts only intact, unexpired signed sessions", () => {
  const now = 1_700_000_000_000;
  const session = createStormPrepSession(now);
  const header = `other=value; maui_storm_prep_auth=${session.value}`;
  assert.equal(stormPrepSessionExpiry(header, now), session.expiresAt);
  assert.equal(stormPrepSessionExpiry(`${header}tampered`, now), undefined);
  assert.equal(
    stormPrepSessionExpiry(header, session.expiresAt + 1),
    undefined,
  );
  assert.match(stormPrepSessionCookie(session.value), /; Secure$/);
});

test("accepts privileged actions only over protected transport", () => {
  assert.equal(isProtectedStormPrepTransport({ encrypted: true }), true);
  assert.equal(
    isProtectedStormPrepTransport({
      remoteAddress: "127.0.0.1",
      forwardedProto: "https",
    }),
    true,
  );
  assert.equal(
    isProtectedStormPrepTransport({
      remoteAddress: "172.30.32.2",
      ingressPath: "/api/hassio_ingress/test",
    }),
    true,
  );
  assert.equal(
    isProtectedStormPrepTransport({
      remoteAddress: "192.168.1.20",
      forwardedProto: "https",
      ingressPath: "/forged",
    }),
    false,
  );
  assert.equal(
    isProtectedStormPrepTransport({
      remoteAddress: "127.0.0.1",
      forwardedProto: "http",
    }),
    false,
  );
});