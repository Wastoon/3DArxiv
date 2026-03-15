/* --- DATA SECTION --- */
let titles_type = ["Dataset", "Survey", "Review", "Overview", "World Model", "Video World Model", "Predictive World Model", "Foundation Model", "Benchmark"];
let titles_model = ["SLAM", "Planning", "Diffusion", "Transformer", "Sora", "BEV", "Occupancy", "VLA", "Vision-Language-Action", "JEPA", "Dreamer", "Gaussian Splatting", "Gaussian Avatar", "UniAD", "Video Generation",
"Digital Human", "Human Avatar", "Animatable", "SMPL", "NeRF Avatar", "Deformable Gaussian", "4D Gaussian", "Dynamic Gaussian"];
let titles_method = ["End-to-End", "Self-Supervised", "Unsupervised", "Reinforcement", "Reinforcement Learning", "Imitation Learning", "Manipulation", "Dexterous", "Humanoid", "Sim-to-Real", "Real-to-Sim", 
"embodied", "world model", "prediction", "trajectory", "motion planning", "control", "MPC", "decision making", "simulation", "simulator", "closed-loop", "interactive", "lane", "road", "urban", "scene", 
"multi-modal", "zero-shot", "few-shot", "navigation", "grasp", "field", "nerf", "point cloud", "lidar", "radar", "sensor fusion", "calibration", "localization", "mapping",
"human body", "body reconstruction", "human rendering", "relightable", "animatable", "clothed human", "free-viewpoint", "novel view synthesis"];

let authors_array = [
    "Shaojie Shen", "Luca Carlone", "Yoshua Bengio", "Frank Dellaert", "Wolfram Burgard", 
    "Davide Scaramuzza", "Marc Pollefeys", "Andrew Davison", "Daniel Cremers", "Heng Yang", 
    "Fei Gao", "Fu Zhang", "Yue Wang", "Hang Zhao", "Timothy D. Barfoot", "Kasra Khosoussi", 
    "Kaiming He", "Shoudong Huang", "Guoquan Huang", "Jonathan P. How", 
    "Guofeng Zhang", "Cyrill Stachniss", "Javier Civera", "Jose Luis Blanco Claraco", 
    "Marco Pavone", "Sanja Fidler", "Yann LeCun", "Raquel Urtasun", 
    "Sergey Levine", "Chelsea Finn", "Jitendra Malik", "Danijar Hafner", "David Ha", 
    "Andreas Geiger", "Philipp Krähenbühl", "Abhinav Gupta", "Animesh Garg",
    "Michael Black", "Gerard Pons-Moll", "Yebin Liu", "Christian Theobalt", "Lingjie Liu",
    "Justus Thies", "Matthias Niessner", "Gordon Wetzstein", "Hao Li"
];

let conferences = [
    // Robotics & AD Top Tier
    "ICRA", "IROS", "RSS", "CORL", "TRO", "IJRR", "JFR", "RA-L", "RAL", "RAM", "L4DC", "IV", "ITSC", "T-ITS", "TITS",
    // AI & ML Top Tier
    "NeurIPS", "NIPS", "ICLR", "ICML", "AAAI", "IJCAI", "AISTATS", "UAI",
    // Computer Vision Top Tier
    "CVPR", "ICCV", "ECCV", "3DV", "WACV", "BMVC",
    // High Impact Journals
    "Science Robotics", "Nature Machine Intelligence", "PAMI", "TIP", "T-RO", "TOG", "TVCG",
    // System & Control
    "CDC", "ACC", "T-CST", "TMECH", "TASE", "RAS",
    // Graphics
    "SIGGRAPH", "SIGGRAPH Asia", "Eurographics", "EG"
];

let top_labs = ["NVIDIA", "DeepMind", "OpenAI", "Google Research", "Stanford", "MIT", "Berkeley", "CMU", "ETH", "Oxford", "Meta AI", "Tesla",
"Max Planck", "MPI", "Tsinghua", "PKU", "NTU", "HKUST"];

/* --- LOGIC SECTION --- */
let titles =  titles_model + titles_method + titles_type;

let start = conferences.shift();
let conferences_rg = conferences.reduce(|sum, v| sum + "|" + v, start);
let conferences_rg = "(" + conferences_rg + ")([\\s'-]*\\d+)?";

let start = titles.shift();
let title_rg = titles.reduce(|sum, v| sum + "|" + v, start);

let start = authors_array.shift();
let authors_rg = authors_array.reduce(|sum, v| sum + "|" + v, start);

let start = top_labs.shift();
let labs_rg = top_labs.reduce(|sum, v| sum + "|" + v, start);

export title_rg;
export authors_rg;
export conferences_rg;
export labs_rg;
