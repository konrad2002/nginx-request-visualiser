import * as mqtt from "mqtt";
import { RequestEvent, MQTTConfig } from "./types";

export type MQTTCallback = (event: RequestEvent | null, error?: string) => void;

export class MQTTClient {
  private client: mqtt.MqttClient | null = null;
  private config: MQTTConfig;
  private connected = false;
  private listeners: MQTTCallback[] = [];

  constructor(config: MQTTConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.client = mqtt.connect(this.config.url, {
          username: this.config.username,
          password: this.config.password,
          clientId: this.config.clientId,
          reconnectPeriod: 1000,
          clean: true,
        });

        this.client.on("connect", () => {
          this.connected = true;
          console.log("MQTT connected");
          this.client!.subscribe(this.config.topic, (err) => {
            if (err) {
              console.error("Failed to subscribe:", err);
              reject(err);
            } else {
              resolve();
            }
          });
        });

        this.client.on("disconnect", () => {
          this.connected = false;
          console.log("MQTT disconnected");
          this.notifyListeners(null, "MQTT Disconnected");
        });

        this.client.on("error", (err) => {
          console.error("MQTT error:", err);
          this.notifyListeners(null, `MQTT Error: ${err.message}`);
          if (!this.connected) {
            reject(err);
          }
        });

        this.client.on("message", (topic: string, message: Buffer) => {
          this.handleMessage(message);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(message: Buffer): void {
    try {
      const text = message.toString("utf-8");
      const data = JSON.parse(text) as RequestEvent;

      // Validate event
      if (!data.type || !data.target || !data.method) {
        console.warn("Invalid message format:", data);
        this.notifyListeners(null, "Invalid message");
        return;
      }

      if (data.type !== "single_request") {
        console.debug("Unknown event type:", data.type);
        return;
      }

      this.notifyListeners(data);
    } catch (error) {
      console.error("Failed to parse MQTT message:", error);
      this.notifyListeners(null, "Failed to parse message");
    }
  }

  subscribe(callback: MQTTCallback): () => void {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notifyListeners(event: RequestEvent | null, error?: string): void {
    this.listeners.forEach((callback) => {
      callback(event, error);
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.end(false, () => {
          this.connected = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
