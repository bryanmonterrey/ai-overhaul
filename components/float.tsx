import { motion } from "framer-motion";

interface FloatProps {
  children: React.ReactNode;
  speed?: number; // Controls the animation speed
  floatIntensity?: number; // Controls the vertical floating range
  rotationIntensity?: number; // Controls the rotation intensity
}

const Float: React.FC<FloatProps> = ({
  children,
  speed = 2,
  floatIntensity = 10,
  rotationIntensity = 15,
}) => {
  return (
    <motion.div
      animate={{
        y: [0, -floatIntensity, 0], // Vertical floating motion
        rotateX: [0, rotationIntensity, 0], // Rotation on X-axis
        rotateY: [0, rotationIntensity, 0], // Rotation on Y-axis
      }}
      transition={{
        duration: speed,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      style={{ display: "inline-block", perspective: 1000 }}
    >
      {children}
    </motion.div>
  );
};

export default Float;
