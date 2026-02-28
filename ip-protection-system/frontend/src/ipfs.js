import axios from "axios";

export async function uploadToIPFS(file) {
    const formData = new FormData();
    formData.append("file", file);
    console.log("JWT:", import.meta.env.VITE_PINATA_JWT);

    const res = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        formData,
        {
            headers: {
                Authorization: `Bearer ${import.meta.env.VITE_PINATA_JWT}`,
            },
        }
    );

    return res.data.IpfsHash; // this is the CID
}
