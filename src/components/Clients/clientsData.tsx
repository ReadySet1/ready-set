import { Client } from "@/types/client";
import { getCloudinaryUrl } from "@/lib/cloudinary";

export const clientsData: Client[] = [
  {
    id: 1,
    title: "GrayGrids",
    logo: getCloudinaryUrl("brands/graygrids"),
    logoWhite: getCloudinaryUrl("brands/graygrids-white"),
    link: "https://graygrids.com/",
  },
  {
    id: 2,
    title: "Lineicons",
    logo: getCloudinaryUrl("brands/lineicons"),
    logoWhite: getCloudinaryUrl("brands/lineicons-white"),
    link: "https://lineicons.com/",
  },
  {
    id: 3,
    title: "Uideck",
    logo: getCloudinaryUrl("brands/uideck"),
    logoWhite: getCloudinaryUrl("brands/uideck-white"),
    link: "https://uideck.com/",
  },
  {
    id: 4,
    title: "AyroUI",
    logo: getCloudinaryUrl("brands/ayroui"),
    logoWhite: getCloudinaryUrl("brands/ayroui-white"),
    link: "https://ayroui.com/",
  },
  {
    id: 5,
    title: "TailGrids",
    logo: getCloudinaryUrl("brands/tailgrids"),
    logoWhite: getCloudinaryUrl("brands/tailgrids-white"),
    link: "https://tailgrids.com/",
  },
];
