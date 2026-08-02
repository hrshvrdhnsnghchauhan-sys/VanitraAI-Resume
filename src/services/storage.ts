import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import app from "./firebase";
import { getStorage as getFirebaseStorage } from "firebase/storage";

const storage = getFirebaseStorage(app);

export async function uploadFile(file: File, pathFolder = "uploads"): Promise<string> {
  if (!file) throw new Error("No file provided");

  try {
    const filename = `${Date.now()}_${file.name}`;
    const storageRef = ref(storage, `${pathFolder}/${filename}`);

    // Generous 60s guard so large resume PDFs never time out on slow networks.
    // The Firebase SDK already retries transient failures internally.
    const uploadTask = (async () => {
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    })();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutTask = new Promise<string>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("Firebase Storage upload timed out (CORS/Network)")),
        60_000,
      );
    });

    try {
      return await Promise.race([uploadTask, timeoutTask]);
    } finally {
      // Never let a resolved upload leave a dangling timer that rejects a
      // settled promise.
      if (timer) clearTimeout(timer);
    }
  } catch (error) {
    console.warn("Firebase Storage upload error or timeout:", error);
    throw error;
  }
}
