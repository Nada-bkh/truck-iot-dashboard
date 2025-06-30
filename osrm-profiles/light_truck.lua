api_version = 1

function node_function(node, result)
  -- Skip node processing
end

function way_function(way, result)
  local highway = way:get_value_by_key("highway")
  local access = way:get_value_by_key("access")
  local maxweight = tonumber(way:get_value_by_key("maxweight")) or 100
  local maxheight = tonumber(way:get_value_by_key("maxheight")) or 5
  local destination = way:get_value_by_key("destination")
  local route = way:get_value_by_key("route")

  if route == "ferry" or not highway then
    result.forward_mode = mode.inaccessible
    result.backward_mode = mode.inaccessible
    return
  end

  if access == "no" or access == "private" or destination == "parking" then
    result.forward_mode = mode.inaccessible
    result.backward_mode = mode.inaccessible
    return
  end

  -- 💡 This is the key difference: allow lighter/shorter vehicles
  if maxweight < 3 or maxheight < 2.8 then
    result.forward_mode = mode.inaccessible
    result.backward_mode = mode.inaccessible
    return
  end

  local speed = {
    motorway = 100,
    trunk = 90,
    primary = 80,
    secondary = 70,
    tertiary = 50,
    unclassified = 40,
    residential = 30,
  }

  result.forward_mode = mode.driving
  result.backward_mode = mode.driving
  result.forward_speed = speed[highway] or 40
  result.backward_speed = speed[highway] or 40
  result.weight = 1.0
end

function turn_function(turn)
  turn.duration = 5
  if turn.angle > 90 or turn.angle < -90 then
    turn.duration = turn.duration + 10
  end
end
