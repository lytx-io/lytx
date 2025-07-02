//import { crypto } from "@cloudflare/workers-types";

export async function hashIpAddress(ipAddress:string, salt:string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(ipAddress + salt); // Combine IP address and salt
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer)); 
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }
  
//crypto

