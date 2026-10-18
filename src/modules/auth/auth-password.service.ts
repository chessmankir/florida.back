import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

@Injectable()
export class AuthPasswordService {
    private static readonly KEY_LENGTH = 64;

    public async hash(password: string): Promise<string> {
        const salt = randomBytes(16);
        const key = await scrypt(password, salt, AuthPasswordService.KEY_LENGTH) as Buffer;
        return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
    }

    public async verify(password: string, encodedHash: string): Promise<boolean> {
        const [algorithm, saltHex, hashHex] = encodedHash.split('$');
        if (algorithm !== 'scrypt' || !saltHex || !hashHex) return false;
        try {
            const expected = Buffer.from(hashHex, 'hex');
            if (expected.length !== AuthPasswordService.KEY_LENGTH) return false;
            const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length) as Buffer;
            return timingSafeEqual(actual, expected);
        } catch {
            return false;
        }
    }
}
